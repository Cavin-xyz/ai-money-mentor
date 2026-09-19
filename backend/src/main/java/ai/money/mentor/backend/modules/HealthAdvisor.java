package ai.money.mentor.backend.modules;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.HealthScoreEngine;
import ai.money.mentor.backend.engine.HealthScoreEngine.Dimension;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class HealthAdvisor implements ModuleAdvisor {

    public record Rec(@JsonPropertyDescription("max 8 words") String title,
            @JsonPropertyDescription("2 sentences with a concrete next step") String detail) {
    }

    public record HealthNarrative(@JsonPropertyDescription("Exactly 4 items, same order as the RECOMMENDATION SLOTS") List<Rec> recommendations) {
    }

    private static final Map<String, String> PRIORITY_COLOR = Map.of(
            "Critical", "text-red-600 bg-red-50 border-red-200",
            "High", "text-amber-600 bg-amber-50 border-amber-200",
            "Medium", "text-blue-600 bg-blue-50 border-blue-200",
            "Good", "text-green-600 bg-green-50 border-green-200");

    private final HealthScoreEngine engine;
    private final RulesRepository rules;
    private final JsonMapper json;

    public HealthAdvisor(HealthScoreEngine engine, RulesRepository rules, JsonMapper json) {
        this.engine = engine;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "health-score";
    }

    @Override
    public String label() {
        return "Money Health Score";
    }

    private record Slot(String priority, Dimension dim, String title, String detail) {
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        var c = engine.calculate(request);
        ObjectNode r = json.createObjectNode();
        r.put("overall", c.overall());
        r.put("overallLabel", c.overallLabel());
        r.put("overallColor", c.overallColor());
        ArrayNode dims = r.putArray("dimensions");
        for (var d : c.dimensions()) {
            dims.addObject().put("key", d.key()).put("label", d.label()).put("dimension", d.dimension()).put("value", d.value())
                    .put("color", d.color()).put("weight", d.weight()).put("formula", d.formula()).put("desc", d.desc());
        }

        List<Slot> slots = slots(c.dimensions(), c.trace());
        ArrayNode recs = r.putArray("recommendations");
        for (var s : slots) {
            recs.addObject().put("priority", s.priority()).put("color", PRIORITY_COLOR.get(s.priority()))
                    .put("dimension", s.dim().key()).put("title", s.title()).put("detail", s.detail());
        }
        r.put("biggestOpportunity", c.biggestOpportunity());

        StringBuilder slotBrief = new StringBuilder();
        for (int i = 0; i < slots.size(); i++) {
            var s = slots.get(i);
            slotBrief.append("Slot ").append(i + 1).append(" · focus: ").append(s.dim().label())
                    .append("\n  facts: ").append(s.detail()).append('\n');
        }
        var task = new NarrativeTask<>(HealthNarrative.class, """
                MODULE: Money Health Score.
                RECOMMENDATION SLOTS (keep this order and focus; improve the wording, keep the facts):
                %s
                For each slot write: title = a short action phrase of 3-8 words (e.g. "Top up your emergency fund"),
                with no scores, colons or priority words; detail = 2 sentences with one concrete next step.
                Slot 4 is a strength: praise it briefly. Only quote ₹ figures that appear in CALCULATIONS.""".formatted(slotBrief),
                n -> {
                    List<String> t = new ArrayList<>();
                    if (n.recommendations() != null) n.recommendations().forEach(x -> { t.add(x.title()); t.add(x.detail()); });
                    return t;
                },
                (res, n) -> {
                    if (n.recommendations() == null || n.recommendations().size() != slots.size()) return;
                    var arr = (ArrayNode) res.get("recommendations");
                    for (int i = 0; i < slots.size(); i++) {
                        var x = n.recommendations().get(i);
                        if (isShortTitle(x.title())) ((ObjectNode) arr.get(i)).put("title", x.title().trim());
                        if (x.detail() != null && !x.detail().isBlank()) ((ObjectNode) arr.get(i)).put("detail", x.detail());
                    }
                });

        Dimension worst = slots.get(0).dim();
        return new Prepared(r, c.trace(), queryFor(worst.key()) + " " + queryFor(slots.get(1).dim().key()),
                rules.defaultTaxYear(), task,
                "Health score " + c.overall() + "/100 (" + c.overallLabel() + "); weakest: " + worst.label(), null);
    }

    /** Small models sometimes echo the brief as the title; keep the engine's title unless it's a real short phrase. */
    static boolean isShortTitle(String t) {
        if (t == null || t.isBlank() || t.length() > 60) return false;
        return !t.contains(":") && !t.contains("/100") && !t.matches("(?i)^(critical|high|medium|good|slot)\\b.*");
    }

    private List<Slot> slots(List<Dimension> dims, CalcTrace t) {
        var sorted = dims.stream().sorted(Comparator.comparingInt(Dimension::value)).toList();
        List<Slot> out = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            var d = sorted.get(i);
            String p = d.value() < 50 ? "Critical" : d.value() < 70 ? "High" : "Medium";
            out.add(new Slot(p, d, title(d, t), detail(d, t)));
        }
        var best = sorted.get(sorted.size() - 1);
        out.add(new Slot("Good", best, "Strength: " + best.label(), best.desc()));
        return out;
    }

    private String title(Dimension d, CalcTrace t) {
        return switch (d.key()) {
            case "emergency" -> "Build a " + (int) rules.planning("emergencyMonths") + "-month emergency fund";
            case "insurance" -> "Close your insurance gap";
            case "diversification" -> "Move toward " + Money.pct(t.facts().getOrDefault("div.eqTarget", 60.0), 0) + " equity";
            case "debt" -> "Bring EMIs under " + (int) rules.planning("emiComfortPct") + "% of income";
            case "tax" -> t.facts().getOrDefault("tax.missed", 0.0) > 0 ? "Claim the deductions you're missing" : "Stay in the cheaper regime";
            case "retirement" -> "Raise your retirement investing";
            default -> "Improve " + d.label();
        };
    }

    private String detail(Dimension d, CalcTrace t) {
        var f = t.facts();
        return switch (d.key()) {
            case "emergency" -> d.desc() + " Add " + Money.inr(f.getOrDefault("em.gap", 0.0)) + " to a savings account or liquid fund.";
            case "insurance" -> d.desc() + " A pure term plan and a family floater are the cheapest ways to close it.";
            case "diversification" -> d.desc() + " Rebalance new SIPs rather than selling.";
            case "debt" -> d.desc() + " Prepay the costliest loan first.";
            case "tax" -> f.getOrDefault("tax.missed", 0.0) > 0
                    ? "You could save " + Money.inr(f.get("tax.missed")) + " a year by using Section 123 (formerly 80C), 80D and NPS in the old regime."
                    : d.desc();
            case "retirement" -> d.desc() + " Increasing your SIP each year with your salary closes the gap fastest.";
            default -> d.desc();
        };
    }

    private static String queryFor(String key) {
        return switch (key) {
            case "emergency" -> "emergency fund liquid savings";
            case "insurance" -> "term life insurance health insurance cover IRDAI 80D";
            case "diversification" -> "mutual fund categories asset allocation risk-o-meter";
            case "debt" -> "loan EMI repayment RBI borrower";
            case "tax" -> "deduction Section 123 80C 80D NPS 80CCD new regime";
            case "retirement" -> "retirement NPS PPF EPF pension";
            default -> key;
        };
    }
}
