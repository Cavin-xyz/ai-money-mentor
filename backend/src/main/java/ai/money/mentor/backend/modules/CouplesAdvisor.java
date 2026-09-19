package ai.money.mentor.backend.modules;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.CoupleOptimizer;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class CouplesAdvisor implements ModuleAdvisor {

    public record CoupleNarrative(
            @JsonPropertyDescription("One per insight, same order; max 2 sentences each") List<String> insights) {
    }

    private final CoupleOptimizer optimizer;
    private final RulesRepository rules;
    private final JsonMapper json;

    public CouplesAdvisor(CoupleOptimizer optimizer, RulesRepository rules, JsonMapper json) {
        this.optimizer = optimizer;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "couples-planner";
    }

    @Override
    public String label() {
        return "Couple's Money Planner";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        var c = optimizer.calculate(request);
        ObjectNode r = json.createObjectNode();
        ArrayNode ins = r.putArray("insights");
        for (var i : c.insights()) {
            ObjectNode o = ins.addObject().put("key", i.key()).put("category", i.category()).put("impactLabel", i.impactLabel())
                    .put("impactType", i.impactType()).put("insight", i.facts());
            if (i.saving() > 0) o.put("estimatedSaving", Money.inr(i.saving()) + "/yr");
            else o.putNull("estimatedSaving");
        }
        ArrayNode partners = r.putArray("partners");
        for (var p : c.partners()) {
            partners.addObject().put("name", p.name()).put("bestRegime", p.bestRegime()).put("bestTax", Money.inr(p.bestTax()))
                    .put("oldTax", Money.inr(p.oldTax())).put("newTax", Money.inr(p.newTax()))
                    .put("marginalRate", Money.pct(p.marginalRatePct(), 0)).put("takeHome", Money.inr(p.monthlyTakeHome()));
        }
        ArrayNode splits = r.putArray("splits");
        for (var s : c.splits()) {
            splits.addObject().put("key", s.key()).put("label", s.label()).put("partner1", Math.round(s.partner1()))
                    .put("partner2", Math.round(s.partner2())).put("leftover1", Math.round(s.leftover1())).put("leftover2", Math.round(s.leftover2()));
        }
        r.put("sharedExpenses", Math.round(c.sharedExpenses()));
        r.putObject("household").put("taxNow", Money.inr(c.householdTaxNow())).put("taxOptimized", Money.inr(c.householdTaxOptimized()))
                .put("saving", Money.inr(c.householdTaxNow() - c.householdTaxOptimized()));

        int n = c.insights().size();
        StringBuilder brief = new StringBuilder();
        for (int i = 0; i < n; i++) brief.append(i + 1).append(". ").append(c.insights().get(i).category()).append(": ").append(c.insights().get(i).facts()).append('\n');
        var task = new NarrativeTask<>(CoupleNarrative.class, """
                MODULE: Couple's Money Planner.
                INSIGHTS (keep order, facts and figures; make each warmer and clearer, max 2 sentences):
                %s""".formatted(brief),
                x -> x.insights() == null ? List.of() : x.insights(),
                (res, x) -> {
                    if (x.insights() == null || x.insights().size() != n) return;
                    var arr = (ArrayNode) res.get("insights");
                    for (int i = 0; i < n; i++) {
                        if (x.insights().get(i) != null && !x.insights().get(i).isBlank()) ((ObjectNode) arr.get(i)).put("insight", x.insights().get(i));
                    }
                });

        return new Prepared(r, c.trace(),
                "clubbing of income spouse gift HRA joint home loan interest co-owner NPS 80CCD(1B) health insurance 80D",
                rules.defaultTaxYear(), task,
                "Household tax " + Money.inr(c.householdTaxNow()) + " → " + Money.inr(c.householdTaxOptimized()), null);
    }
}
