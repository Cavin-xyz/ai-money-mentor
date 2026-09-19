package ai.money.mentor.backend.modules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.Inputs;
import ai.money.mentor.backend.engine.SchemeEngine;
import ai.money.mentor.backend.engine.SchemeEngine.Match;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * "Schemes for you": the government schemes a person qualifies for, matched by rules rather than
 * by asking the model. Written for someone who has never heard of PMJJBY or Sukanya Samriddhi —
 * the engine decides eligibility, the model explains why each one is worth their while.
 */
@Component
public class SchemeAdvisor implements ModuleAdvisor {

    public record SchemeNote(@JsonPropertyDescription("The scheme's short name exactly as given") String scheme,
            @JsonPropertyDescription("1-2 sentences on what this person gets from it, using only the given figures") String why) {
    }

    public record SchemeNarrative(
            @JsonPropertyDescription("2 sentences: how many schemes fit and which one to do first") String headline,
            @JsonPropertyDescription("One entry per scheme listed in the brief, same order") List<SchemeNote> schemes) {
    }

    private final SchemeEngine engine;
    private final RulesRepository rules;
    private final JsonMapper json;

    public SchemeAdvisor(SchemeEngine engine, RulesRepository rules, JsonMapper json) {
        this.engine = engine;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "schemes";
    }

    @Override
    public String label() {
        return "Schemes for you";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        var c = engine.calculate(withProfile(request, user));
        ObjectNode r = json.createObjectNode();
        r.put("eligibleCount", c.eligible().size());
        r.put("totalAnnualCost", Money.inr(c.totalAnnualCost()));
        r.put("totalCover", Money.compact(c.totalCover()));
        r.put("taxPayer", c.taxPayer());
        r.put("unverified", c.anyUnverified());
        r.put("headline", templateHeadline(c));

        items(r.putArray("schemes"), c.eligible());
        items(r.putArray("notEligible"), c.notEligible());

        int n = c.eligible().size();
        StringBuilder brief = new StringBuilder();
        for (Match m : c.eligible()) {
            brief.append("- ").append(m.shortName()).append(": ").append(m.what())
                    .append(" Facts: ").append(m.reason())
                    .append(m.annualCost() > 0 ? "; costs " + Money.inr(m.annualCost()) + "/yr" : "")
                    .append(m.benefit() > 0 ? "; gives " + Money.compact(m.benefit()) : "")
                    .append(m.section() != null ? "; deduction under " + m.section() : "")
                    .append('\n');
        }

        var task = new NarrativeTask<>(SchemeNarrative.class, """
                MODULE: Schemes for you — government schemes this person qualifies for.
                Write headline: 2 sentences — how many schemes fit and which to do first, and why that one.
                Write schemes: exactly %d entries, one per scheme below, same order, "scheme" copied exactly.
                Assume the reader has never heard of these schemes. No jargon.
                Use ONLY the figures listed on that scheme's own line — never a number from another scheme,
                and never invent one.
                %s""".formatted(n, brief),
                x -> {
                    List<String> texts = new ArrayList<>();
                    texts.add(x.headline());
                    if (x.schemes() != null) x.schemes().forEach(s -> texts.add(s.why()));
                    return texts;
                },
                (res, x) -> {
                    if (x.headline() != null && !x.headline().isBlank()) res.put("headline", x.headline());
                    if (x.schemes() == null) return;
                    ArrayNode arr = (ArrayNode) res.get("schemes");
                    for (SchemeNote note : x.schemes()) {
                        for (int i = 0; i < arr.size(); i++) {
                            ObjectNode o = (ObjectNode) arr.get(i);
                            if (o.path("short").asString("").equalsIgnoreCase(note.scheme()) && note.why() != null && !note.why().isBlank()) {
                                o.put("why", note.why());
                            }
                        }
                    }
                });

        return new Prepared(r, c.trace(),
                "PMJJBY PMSBY Atal Pension Yojana NPS Sukanya Samriddhi PPF small savings deduction Section 123 80C",
                rules.defaultTaxYear(), task,
                c.eligible().size() + " schemes fit, " + Money.inr(c.totalAnnualCost()) + "/yr for "
                        + Money.compact(c.totalCover()) + " of cover", null);
    }

    private void items(ArrayNode arr, List<Match> matches) {
        for (Match m : matches) {
            arr.addObject()
                    .put("id", m.id())
                    .put("name", m.name())
                    .put("short", m.shortName())
                    .put("category", m.category())
                    .put("status", m.status())
                    .put("what", m.what())
                    .put("reason", m.reason())
                    .put("why", m.what())
                    .put("cost", m.annualCost() > 0 ? Money.inr(m.annualCost()) + "/yr" : "—")
                    .put("benefit", m.benefit() > 0 ? Money.compact(m.benefit()) : "—")
                    .put("section", m.section())
                    .put("action", m.action())
                    .put("authority", m.authority())
                    .put("source", m.source())
                    .put("confirmed", m.confirmed());
        }
    }

    /** Shown while the model is still writing, and whenever it is unavailable. */
    private static String templateHeadline(SchemeEngine.SchemeCalc c) {
        if (c.eligible().isEmpty()) return "No government scheme matched the details you entered.";
        String first = c.eligible().get(0).shortName();
        return c.eligible().size() + " government schemes fit your details. Start with " + first + ".";
    }

    /** Fills anything the form left blank from the saved profile, so a returning user answers less. */
    private static Map<String, Object> withProfile(Map<String, Object> request, UserContext user) {
        if (!user.hasProfile()) return request;
        Map<String, Object> merged = new java.util.LinkedHashMap<>(user.profile());
        merged.keySet().retainAll(List.of("age", "monthlyIncome", "dependents", "lifeCover", "healthCover"));
        request.forEach((k, v) -> {
            if (v != null && !String.valueOf(v).isBlank()) merged.put(k, v);
        });
        if (Inputs.num(merged, "age") <= 0) merged.remove("age");
        return merged;
    }
}
