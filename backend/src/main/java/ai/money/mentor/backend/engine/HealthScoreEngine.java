package ai.money.mentor.backend.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;

/**
 * Six-dimension financial health score with visible formulas and weights. Replaces the
 * LLM-invented scores: every value here can be traced to the user's own inputs.
 */
@Component
public class HealthScoreEngine {

    private final RulesRepository rules;
    private final TaxEngine taxEngine;

    public HealthScoreEngine(RulesRepository rules, TaxEngine taxEngine) {
        this.rules = rules;
        this.taxEngine = taxEngine;
    }

    public record Dimension(String key, String label, String dimension, int value, String color, int weight,
            String formula, String desc, double gapAmount) {
    }

    public record HealthCalc(int overall, String overallLabel, String overallColor, List<Dimension> dimensions,
            String biggestOpportunity, double taxMissed, CalcTrace trace) {
    }

    public HealthCalc calculate(Map<String, Object> f) {
        var t = new CalcTrace();
        double income = Inputs.num(f, "monthlyIncome");
        double expenses = Inputs.num(f, "monthlyExpenses");
        if (income <= 0 || expenses <= 0) throw new IllegalArgumentException("Monthly income and expenses are required");
        double liquid = Inputs.num(f, "liquidSavings");
        boolean dependents = Inputs.yes(f, "dependents");
        double life = Inputs.num(f, "lifeCover");
        double health = Inputs.num(f, "healthCover");
        boolean invests = Inputs.yes(f, "investOutsideFd");
        double equityPct = Inputs.num(f, "equityPct", 60);
        double emi = Inputs.num(f, "monthlyEmi");
        boolean did80C = Inputs.yes(f, "exhausted80C");
        boolean did80D = Inputs.yes(f, "claim80D");
        boolean didNps = Inputs.yes(f, "useNPS");
        int age = (int) Inputs.num(f, "currentAge", 30);
        int retireAge = (int) Inputs.num(f, "targetRetirementAge", 60);
        double corpus = Inputs.num(f, "retirementCorpus");

        List<Dimension> dims = new ArrayList<>();

        // 1. Emergency fund — months of expenses in liquid savings
        t.group("Emergency Fund (weight 20)");
        double target = rules.planning("emergencyMonths");
        double months = liquid / expenses;
        int sEm = score(months / target * 100);
        double emGap = Math.max(0, target * expenses - liquid);
        t.step("Months covered", Money.inr(liquid) + " ÷ " + Money.inr(expenses), String.format("%.1f months", months));
        t.step("Score", "months ÷ " + (int) target + " × 100 (max 100)", sEm + "/100");
        t.fact("em.months", months);
        t.fact("em.gap", emGap);
        t.fact("em.target", target * expenses);
        dims.add(dim("emergency", "Emergency Fund", "Emergency", sEm, 20,
                String.format("%.1f months ÷ %d months", months, (int) target),
                String.format("%.1f months of expenses covered; target is %d months%s.", months, (int) target,
                        emGap > 0 ? " (" + Money.compact(emGap) + " short)" : ""), emGap));

        // 2. Insurance — life cover vs 10x income (if dependents) + health cover vs baseline
        t.group("Insurance Coverage (weight 20)");
        double annualIncome = income * 12;
        double lifeNeeded = dependents ? annualIncome * rules.planning("minTermCoverMultiple") : 0;
        double healthNeeded = rules.planning("healthCoverTarget");
        int lifeScore = dependents ? score(life / lifeNeeded * 100) : 100;
        int healthScore = score(health / healthNeeded * 100);
        int sIns = (int) Math.round(dependents ? 0.5 * lifeScore + 0.5 * healthScore : 0.3 * lifeScore + 0.7 * healthScore);
        double lifeGap = Math.max(0, lifeNeeded - life);
        double healthGap = Math.max(0, healthNeeded - health);
        if (dependents) t.step("Life cover needed", Money.inr(annualIncome) + " × " + (int) rules.planning("minTermCoverMultiple"), Money.compact(lifeNeeded));
        t.step("Life cover score", dependents ? Money.compact(life) + " ÷ " + Money.compact(lifeNeeded) : "no dependents → 100", lifeScore + "/100");
        t.step("Health cover score", Money.compact(health) + " ÷ " + Money.compact(healthNeeded), healthScore + "/100");
        t.step("Score", dependents ? "50% life + 50% health" : "30% life + 70% health", sIns + "/100");
        t.fact("ins.lifeGap", lifeGap);
        t.fact("ins.healthGap", healthGap);
        t.fact("ins.lifeNeeded", lifeNeeded);
        String insDesc = (dependents && lifeGap > 0 ? "Life cover gap " + Money.compact(lifeGap) + ". " : "")
                + (healthGap > 0 ? "Health cover is " + Money.compact(healthGap) + " below the " + Money.compact(healthNeeded) + " baseline." : "Health cover meets the baseline.");
        dims.add(dim("insurance", "Insurance Coverage", "Insurance", sIns, 20,
                dependents ? "50% life + 50% health cover" : "30% life + 70% health cover", insDesc.trim(), lifeGap + healthGap));

        // 3. Diversification — equity share vs age-based target
        t.group("Investment Diversification (weight 15)");
        double eqTarget = Finance.clamp(100 - age, 30, 80);
        int sDiv = invests ? score(100 - Math.abs(equityPct - eqTarget) * 2) : 25;
        t.step("Target equity share", "100 − age, kept within 30–80%", Money.pct(eqTarget, 0));
        t.step("Score", invests ? "100 − 2 × |" + Money.pct(equityPct, 0) + " − " + Money.pct(eqTarget, 0) + "|" : "savings/FDs only → 25", sDiv + "/100");
        t.fact("div.eqTarget", eqTarget);
        t.fact("div.eqPct", equityPct);
        dims.add(dim("diversification", "Investment Diversification", "Diversification", sDiv, 15,
                "equity " + Money.pct(equityPct, 0) + " vs target " + Money.pct(eqTarget, 0),
                invests ? String.format("%.0f%% equity vs an age-based target of %.0f%%.", equityPct, eqTarget)
                        : "All savings in FDs/savings accounts — returns may trail inflation.", 0));

        // 4. Debt — EMI to income
        t.group("Debt Health (weight 15)");
        double emiRatio = emi / income * 100;
        int sDebt = emiRatio <= 10 ? 100 : emiRatio <= 40 ? score(100 - (emiRatio - 10) * 2)
                : emiRatio <= 60 ? score(40 - (emiRatio - 40) * 2) : 0;
        t.step("EMI-to-income", Money.inr(emi) + " ÷ " + Money.inr(income), Money.pct(emiRatio, 0));
        t.step("Score", "≤10% → 100, falls to 40 at 40%, 0 at 60%", sDebt + "/100");
        t.fact("debt.ratio", emiRatio);
        dims.add(dim("debt", "Debt Health", "Debt Health", sDebt, 15, "EMI " + Money.pct(emiRatio, 0) + " of income",
                String.format("EMIs take %.0f%% of take-home pay (lenders cap near %d%%).", emiRatio, (int) rules.planning("foirMaxPct")), 0));

        // 5. Tax efficiency — only matters if the old regime could beat the new one
        t.group("Tax Efficiency (weight 15)");
        var tax = taxEngine.compare(TaxInput.salary(annualIncome)
                .sec80C(did80C ? 150_000 : 0).sec80D(did80D ? 25_000 : 0).sec80CCD1B(didNps ? 50_000 : 0));
        double best = Math.min(tax.newRegime().totalTax(), tax.oldRegime().totalTax());
        double bestPossible = Math.min(tax.newRegime().totalTax(), tax.oldRegimeTaxIfMaxed());
        double missed = Math.max(0, best - bestPossible);
        int sTax = missed <= 0 ? 100 : score(100 - missed / Math.max(1, best) * 100 * 2);
        t.step("Current best tax", "min(new, old with your deductions)", Money.inr(best));
        t.step("Best possible tax", "min(new, old with Sec 123 + 80D + NPS maxed)", Money.inr(bestPossible));
        t.step("Tax you could still save", "current − best possible", Money.inr(missed));
        t.step("Score", missed <= 0 ? "already optimal → 100" : "100 − 2 × missed/current", sTax + "/100");
        t.fact("tax.missed", missed);
        t.fact("tax.best", best);
        t.fact("tax.bestPossible", bestPossible);
        dims.add(dim("tax", "Tax Efficiency", "Tax Efficiency", sTax, 15, "missed " + Money.inr(missed) + "/yr",
                missed > 0 ? Money.inr(missed) + " a year in unused deductions (old regime)."
                        : "The new regime already minimises your tax; extra deductions won't help.", missed));

        // 6. Retirement readiness — projected corpus vs required corpus
        t.group("Retirement Readiness (weight 15)");
        int yrs = Math.max(1, retireAge - age);
        double infl = rules.assumption("inflationPct");
        double need = Finance.inflate(expenses * 12, infl, yrs) / (rules.assumption("withdrawalRatePct") / 100);
        double surplus = Math.max(0, income - expenses - emi);
        double growth = 10;
        double projected = Finance.fv(corpus, growth, yrs) + Finance.fvSip(surplus * 0.5, growth, yrs);
        double ratio = projected / need * 100;
        int sRet = score(ratio);
        t.step("Corpus needed at " + retireAge, "expenses inflated at " + Money.pct(infl) + " ÷ " + Money.pct(rules.assumption("withdrawalRatePct")), Money.compact(need));
        t.step("Projected corpus", "current " + Money.compact(corpus) + " + half of surplus (" + Money.inr(surplus * 0.5) + "/mo) at " + Money.pct(growth), Money.compact(projected));
        t.step("Score", "projected ÷ needed × 100", sRet + "/100");
        t.assume("Retirement score assumes half your monthly surplus is invested at 10% a year");
        t.fact("ret.need", need);
        t.fact("ret.projected", projected);
        t.fact("ret.gap", Math.max(0, need - projected));
        dims.add(dim("retirement", "Retirement Readiness", "Retirement", sRet, 15,
                Money.compact(projected) + " ÷ " + Money.compact(need),
                "On track for " + Money.compact(projected) + " of the " + Money.compact(need) + " needed at " + retireAge + ".",
                Math.max(0, need - projected)));

        // Overall
        t.group("Overall");
        double weighted = dims.stream().mapToDouble(d -> d.value() * d.weight()).sum() / 100.0;
        int overall = (int) Math.round(weighted);
        String label = overall >= 80 ? "Excellent" : overall >= 70 ? "Good" : overall >= 50 ? "Needs Attention" : "Critical";
        t.step("Overall score", "Σ(score × weight) ÷ 100", overall + "/100 · " + label);
        t.fact("overall", overall);
        for (var d : dims) t.fact("score." + d.key(), d.value());

        Dimension worst = dims.stream().max(Comparator.comparingDouble(d -> (100 - d.value()) * d.weight())).orElseThrow();
        String opportunity = worst.label() + (worst.gapAmount() > 0 && "tax".equals(worst.key())
                ? " (+" + Money.inr(worst.gapAmount()) + "/yr)"
                : worst.gapAmount() > 0 ? " (" + Money.compact(worst.gapAmount()) + " gap)" : "");

        return new HealthCalc(overall, label, color(overall), dims, opportunity, missed, t);
    }

    private static Dimension dim(String key, String label, String dimension, int value, int weight, String formula,
            String desc, double gap) {
        return new Dimension(key, label, dimension, value, color(value), weight, formula, desc, gap);
    }

    static String color(int score) {
        return score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
    }

    private static int score(double v) {
        return (int) Math.round(Finance.clamp(v, 0, 100));
    }
}
