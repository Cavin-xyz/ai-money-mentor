package ai.money.mentor.backend.modules;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.FireProjection;
import ai.money.mentor.backend.engine.Inputs;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class FireAdvisor implements ModuleAdvisor {

    public record FireNarrative(
            @JsonPropertyDescription("2 sentences: is the plan on track, and the single most important lever") String fireImpact,
            @JsonPropertyDescription("One short action (max 12 words) per milestone, in the same order") List<String> milestoneActions) {
    }

    private final FireProjection fire;
    private final RulesRepository rules;
    private final JsonMapper json;

    public FireAdvisor(FireProjection fire, RulesRepository rules, JsonMapper json) {
        this.fire = fire;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "fire";
    }

    @Override
    public String label() {
        return "FIRE Path Planner";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        Map<String, Object> req = new HashMap<>(request);
        boolean goalsFromMemory = false;
        if (Inputs.list(req, "lifeGoals").isEmpty() && !user.goals().isEmpty()) {
            req.put("lifeGoals", user.goals());
            goalsFromMemory = true;
        }
        var c = fire.calculate(req);
        if (goalsFromMemory) c.trace().assume("Life goals loaded from your saved profile");

        ObjectNode r = json.createObjectNode();
        r.put("fireNumber", Money.compact(c.fireNumber()));
        r.put("yearsToFire", c.yearsToFire() > 60 ? "Not reachable yet" : c.yearsToFire() + " years");
        r.put("requiredMonthlySip", Money.inr(c.requiredMonthlySip()));
        r.put("currentSavingsRate", Money.pct(c.currentSavingsRatePct(), 0));
        r.put("requiredSavingsRate", Money.pct(c.requiredSavingsRatePct(), 0));

        ArrayNode sip = r.putArray("sipAllocation");
        for (var b : c.sipAllocation()) {
            sip.addObject().put("category", b.category()).put("amount", Money.inr(b.amount()))
                    .put("percentage", Money.pct(b.percentage(), 0)).put("recommendation", b.recommendation());
        }
        ArrayNode goals = r.putArray("goals");
        for (var g : c.goals()) {
            goals.addObject().put("name", g.name()).put("target", Money.compact(g.targetFuture()))
                    .put("targetToday", Money.compact(g.targetToday())).put("monthlySlip", Money.inr(g.monthlySip()))
                    .put("fundType", g.fundType()).put("timelineYears", String.valueOf(g.years()));
        }
        ArrayNode ms = r.putArray("milestones");
        for (var m : c.milestones()) {
            ms.addObject().put("year", String.valueOf(m.year())).put("age", m.age())
                    .put("portfolioValue", Money.compact(m.portfolioValue())).put("action", m.action()).put("allocation", m.allocation());
        }
        ObjectNode ins = r.putObject("insurance");
        ins.putObject("termLife").put("recommended", Money.compact(c.termCover()))
                .put("note", (int) rules.planning("termCoverMultiple") + "× annual income");
        ins.putObject("health").put("recommended", Money.compact(c.healthCover())).put("note", "Family floater + super top-up");
        ins.putObject("emergencyFund").put("target", Money.compact(c.emergencyTarget())).put("currentGap", Money.compact(c.emergencyGap()))
                .put("note", (int) rules.planning("emergencyMonths") + " months of expenses");
        ArrayNode moves = r.putArray("taxMoves");
        for (var t : c.taxMoves()) moves.addObject().put("section", t.section()).put("action", t.action()).put("saving", Money.inr(t.saving()));
        r.put("regimeRecommendation", c.regimeRecommendation());
        r.put("fireImpact", templateImpact(c));

        // Numeric data for charts and what-ifs
        r.put("feasible", c.feasible());
        r.put("successPct", Math.round(c.successPct()));
        r.put("retirementAge", c.retirementAge());
        r.put("currentAge", c.currentAge());
        r.put("fireAgeWithFullSurplus", c.fireAgeWithFullSurplus());
        if (c.coastFireAge() != null) r.put("coastFireAge", c.coastFireAge());
        ObjectNode num = r.putObject("numbers");
        num.put("fireNumber", Math.round(c.fireNumber()));
        num.put("requiredSip", Math.round(c.requiredMonthlySip()));
        num.put("additionalSip", Math.round(c.additionalSip()));
        num.put("goalSips", Math.round(c.goalSipTotal()));
        num.put("surplus", Math.round(c.monthlySurplus()));
        r.set("assumptions", json.valueToTree(c.assumptions()));
        ArrayNode proj = r.putArray("projection");
        for (int i = 0; i < c.projection().size(); i++) {
            var p = c.projection().get(i);
            var b = i < c.bands().size() ? c.bands().get(i) : null;
            ObjectNode pt = proj.addObject().put("age", p.age()).put("year", p.year()).put("corpus", Math.round(p.corpus()))
                    .put("target", Math.round(p.target())).put("invested", Math.round(p.invested()));
            if (b != null) pt.put("p10", Math.round(b.p10())).put("p50", Math.round(b.p50())).put("p90", Math.round(b.p90()));
        }

        int milestoneCount = c.milestones().size();
        var task = new NarrativeTask<>(FireNarrative.class, """
                MODULE: FIRE (financial independence) roadmap.
                Write fireImpact: 2 sentences — whether the required SIP fits the user's monthly surplus, and the one lever
                that matters most (SIP amount, retirement age, or expenses). Quote at most two ₹ figures from CALCULATIONS.
                Write milestoneActions: exactly %d short actions (max 12 words each), one per milestone in order.
                Mention tax only via sections present in CALCULATIONS or SOURCES.""".formatted(milestoneCount),
                n -> {
                    List<String> t = new ArrayList<>();
                    t.add(n.fireImpact());
                    if (n.milestoneActions() != null) t.addAll(n.milestoneActions());
                    return t;
                },
                (res, n) -> {
                    if (n.fireImpact() != null && !n.fireImpact().isBlank()) res.put("fireImpact", n.fireImpact());
                    if (n.milestoneActions() != null && n.milestoneActions().size() == milestoneCount) {
                        var arr = (ArrayNode) res.get("milestones");
                        for (int i = 0; i < milestoneCount; i++) ((ObjectNode) arr.get(i)).put("action", n.milestoneActions().get(i));
                    }
                });

        String winner = c.regimeRecommendation().startsWith("Old") ? "old" : "new";
        return new Prepared(r, c.trace(),
                "FIRE early retirement corpus NPS PPF EPF withdrawal tax Section 123 80C new tax regime Section 202",
                rules.defaultTaxYear(), task,
                "FIRE number " + Money.compact(c.fireNumber()) + " by " + c.retirementAge() + "; SIP " + Money.inr(c.requiredMonthlySip()) + "/mo",
                winner);
    }

    private static String templateImpact(FireProjection.FireCalc c) {
        double total = c.requiredMonthlySip() + c.goalSipTotal();
        if (c.feasible()) {
            return "Investing " + Money.inr(total) + " a month fits within your " + Money.inr(c.monthlySurplus())
                    + " monthly surplus, putting FIRE at " + c.retirementAge() + " within reach (" + Math.round(c.successPct())
                    + "% of simulated markets).";
        }
        return "You need " + Money.inr(total) + " a month but have a " + Money.inr(c.monthlySurplus())
                + " surplus; retiring later, trimming expenses or raising the SIP each year closes the gap.";
    }
}
