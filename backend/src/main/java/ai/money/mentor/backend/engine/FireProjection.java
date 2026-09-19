package ai.money.mentor.backend.engine;

import java.time.Year;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.JsonNode;

/**
 * FIRE maths: inflation-adjusted target, glide-path projection, required SIP (solved by
 * bisection on the projection), goal SIPs, insurance gaps, tax moves and a seeded
 * 1,000-scenario simulation. Same inputs always give the same numbers.
 */
@Component
public class FireProjection {

    private static final int SCENARIOS = 1000;

    private final RulesRepository rules;
    private final TaxEngine taxEngine;

    public FireProjection(RulesRepository rules, TaxEngine taxEngine) {
        this.rules = rules;
        this.taxEngine = taxEngine;
    }

    public record Assumptions(double inflationPct, double equityReturnPct, double debtReturnPct,
            double withdrawalRatePct) {
    }

    public record GoalPlan(String name, double targetToday, double targetFuture, int years, String fundType,
            double returnPct, double monthlySip) {
    }

    public record SipBucket(String category, double amount, double percentage, String recommendation) {
    }

    public record Milestone(int year, int age, double portfolioValue, String action, String allocation) {
    }

    public record ProjectionPoint(int year, int age, double corpus, double target, double invested) {
    }

    public record Band(int age, double p10, double p50, double p90) {
    }

    public record TaxMove(String section, String action, double saving) {
    }

    public record FireCalc(int currentAge, int retirementAge, int years, Assumptions assumptions,
            double monthlyIncome, double monthlyExpenses, double monthlySurplus, double annualExpensesAtRetirement,
            double fireNumber, double existingCorpus, double existingSips, double requiredMonthlySip,
            double additionalSip, double goalSipTotal, double currentSavingsRatePct, double requiredSavingsRatePct,
            int yearsToFire, int fireAgeWithFullSurplus, Integer coastFireAge, boolean feasible,
            List<GoalPlan> goals, List<SipBucket> sipAllocation, List<Milestone> milestones,
            double termCover, double healthCover, double emergencyTarget, double emergencyGap,
            List<TaxMove> taxMoves, String regimeRecommendation, double successPct, List<Band> bands,
            List<ProjectionPoint> projection, CalcTrace trace) {
    }

    public FireCalc calculate(Map<String, Object> req) {
        var t = new CalcTrace();
        int age = (int) Finance.clamp(Inputs.num(req, "currentAge", 30), 18, 80);
        int retireAge = (int) Finance.clamp(Inputs.num(req, "retirementAge", 50), age + 1, 85);
        int years = retireAge - age;
        double income = Inputs.num(req, "monthlyIncome");
        double expenses = Inputs.num(req, "monthlyExpenses");
        double bonus = Inputs.num(req, "annualBonus");
        double savings = Inputs.num(req, "currentSavings");
        double sips = Inputs.num(req, "existingSips");
        double ppfEpf = Inputs.num(req, "ppfEpfBalance");
        double emergency = Inputs.num(req, "emergencyFund");
        double extraSip = Inputs.num(req, "extraMonthlySip");
        if (income <= 0 || expenses <= 0) {
            throw new IllegalArgumentException("Monthly income and expenses are required");
        }

        Map<String, Object> a = Inputs.map(req, "assumptions");
        var as = new Assumptions(
                Inputs.num(a, "inflationPct", rules.assumption("inflationPct")),
                Inputs.num(a, "equityReturnPct", rules.assumption("equityReturnPct")),
                Inputs.num(a, "debtReturnPct", rules.assumption("debtReturnPct")),
                Inputs.num(a, "withdrawalRatePct", rules.assumption("withdrawalRatePct")));

        t.group("Assumptions");
        t.step("Inflation", "assumption (adjustable)", Money.pct(as.inflationPct()));
        t.step("Equity return", "assumption (adjustable)", Money.pct(as.equityReturnPct()));
        t.step("Debt return", "assumption (adjustable)", Money.pct(as.debtReturnPct()));
        t.step("Safe withdrawal rate", rules.assumptionNote("withdrawalRatePct"), Money.pct(as.withdrawalRatePct()));
        t.assume("Returns are long-run assumptions, not guarantees");

        // ── FIRE number ────────────────────────────────────────────────
        t.group("FIRE number");
        double annualToday = expenses * 12;
        double annualAtRetire = Finance.inflate(annualToday, as.inflationPct(), years);
        double fireNumber = annualAtRetire / (as.withdrawalRatePct() / 100);
        t.step("Annual expenses today", Money.inr(expenses) + " × 12", Money.inr(annualToday));
        t.step("Expenses at age " + retireAge, Money.inr(annualToday) + " × (1 + " + Money.pct(as.inflationPct()) + ")^" + years, Money.inr(annualAtRetire));
        t.step("FIRE number", Money.inr(annualAtRetire) + " ÷ " + Money.pct(as.withdrawalRatePct()), Money.compact(fireNumber));
        t.fact("fire.number", fireNumber);
        t.fact("fire.expensesAtRetirement", annualAtRetire);
        t.fact("fire.annualExpensesToday", annualToday);
        t.fact("fire.years", years);
        t.fact("fire.retirementAge", retireAge);

        // ── Required SIP ───────────────────────────────────────────────
        t.group("Monthly SIP needed");
        double corpus0 = savings + ppfEpf;
        double required = solveSip(corpus0, years, fireNumber, as);
        double additional = Math.max(0, required - sips);
        double surplus = income - expenses;
        t.step("Invested today", "savings + PPF/EPF (emergency fund kept aside)", Money.inr(corpus0));
        t.step("Required monthly SIP", "solved so projected corpus at " + retireAge + " = FIRE number", Money.inr(required));
        t.step("Already investing", "existing SIPs", Money.inr(sips));
        t.step("Additional SIP needed", "required − existing", Money.inr(additional));
        t.fact("fire.requiredSip", required);
        t.fact("fire.additionalSip", additional);
        t.fact("fire.existingCorpus", corpus0);
        t.fact("fire.surplus", surplus);

        // ── Goals ──────────────────────────────────────────────────────
        List<GoalPlan> goals = new ArrayList<>();
        t.group("Life goals");
        for (var g : Inputs.list(req, "lifeGoals")) {
            int gy = (int) Finance.clamp(Inputs.num(g, "years", 5), 1, 40);
            double today = Inputs.num(g, "amount");
            if (today <= 0) continue;
            double future = Finance.inflate(today, as.inflationPct(), gy);
            String fund = gy <= 3 ? "Debt" : gy <= 7 ? "Hybrid" : "Equity";
            double rate = gy <= 3 ? as.debtReturnPct() : gy <= 7 ? rules.assumption("hybridReturnPct") : as.equityReturnPct();
            double sip = Finance.sipForTarget(future, rate, gy, 0);
            String name = Inputs.str(g, "name", "Goal");
            goals.add(new GoalPlan(name, today, future, gy, fund, rate, sip));
            t.step(name + " in " + gy + " yrs", Money.inr(today) + " inflated → " + Money.compact(future) + ", " + fund + " @ " + Money.pct(rate), Money.inr(sip) + "/mo");
            t.fact("goal." + goals.size() + ".sip", sip);
            t.fact("goal." + goals.size() + ".future", future);
        }
        double goalSips = goals.stream().mapToDouble(GoalPlan::monthlySip).sum();

        double totalNeeded = required + goalSips;
        boolean feasible = surplus >= totalNeeded;
        double currentRate = surplus / income * 100;
        double requiredRate = totalNeeded / income * 100;
        t.group("Savings rate");
        t.step("Savings capacity", "(income − expenses) ÷ income", Money.pct(currentRate, 0));
        t.step("Savings rate needed", "(FIRE SIP + goal SIPs) ÷ income", Money.pct(requiredRate, 0));
        t.fact("fire.currentSavingsRate", currentRate);
        t.fact("fire.requiredSavingsRate", requiredRate);
        t.fact("fire.goalSips", goalSips);
        t.fact("fire.totalSip", totalNeeded);

        // Earliest FIRE if the whole surplus (+ extra what-if SIP) is invested
        double investable = Math.max(0, surplus - goalSips) + extraSip;
        int yearsToFire = yearsUntilFire(corpus0, investable, annualToday, as, age);
        t.step("Years to FIRE at full surplus", "investing " + Money.inr(investable) + "/mo until corpus ≥ inflating target",
                yearsToFire > 60 ? "not reachable" : yearsToFire + " years");
        t.fact("fire.yearsToFire", yearsToFire);

        Integer coastAge = null;
        for (int y = 0; y <= years; y++) {
            double grown = corpus(corpus0, 0, y, years, as);
            double remaining = years - y;
            if (Finance.fv(grown, blended(as, (int) remaining), remaining) >= fireNumber) {
                coastAge = age + y;
                break;
            }
        }

        // ── SIP allocation (category level only) ───────────────────────
        int eqPct = equityPct(years);
        List<SipBucket> buckets = new ArrayList<>();
        for (JsonNode b : rules.planningNode("sipBuckets")) {
            double sleeve = "equity".equals(b.path("sleeve").asString()) ? eqPct / 100.0 : 1 - eqPct / 100.0;
            double share = sleeve * b.path("sharePct").asDouble() / 100;
            buckets.add(new SipBucket(b.path("category").asString(), required * share, share * 100,
                    b.path("recommendation").asString()));
        }

        // ── Projection, milestones ─────────────────────────────────────
        List<ProjectionPoint> projection = project(corpus0, required + extraSip, years, years, as, age, annualToday);
        List<Milestone> milestones = milestones(projection, years, age, retireAge, required, coastAge, fireNumber, as);

        // ── Insurance ──────────────────────────────────────────────────
        t.group("Protection");
        double annualIncome = income * 12 + bonus;
        double termCover = annualIncome * rules.planning("termCoverMultiple");
        double healthCover = rules.planning("healthCoverTarget");
        double emergencyTarget = expenses * rules.planning("emergencyMonths");
        double emergencyGap = Math.max(0, emergencyTarget - emergency);
        t.step("Term life cover", Money.inr(annualIncome) + " × " + (int) rules.planning("termCoverMultiple"), Money.compact(termCover));
        t.step("Health cover", "family floater baseline", Money.compact(healthCover));
        t.step("Emergency fund target", (int) rules.planning("emergencyMonths") + " × monthly expenses", Money.inr(emergencyTarget));
        t.step("Emergency fund gap", "target − current " + Money.inr(emergency), Money.inr(emergencyGap));
        t.fact("ins.term", termCover);
        t.fact("ins.health", healthCover);
        t.fact("ins.emergencyTarget", emergencyTarget);
        t.fact("ins.emergencyGap", emergencyGap);

        // ── Tax moves ──────────────────────────────────────────────────
        var tax = taxEngine.compare(TaxInput.salary(annualIncome));
        List<TaxMove> moves = new ArrayList<>();
        boolean oldWinsIfMaxed = tax.oldRegimeTaxIfMaxed() < tax.newRegime().totalTax();
        if (oldWinsIfMaxed) {
            for (var g : tax.gaps()) {
                if (g.oldRegimeSaving() > 0) moves.add(new TaxMove(g.section(), g.label(), g.oldRegimeSaving()));
            }
        } else {
            // Old-regime deductions save nothing here; employer NPS is the one lever the new regime allows
            var r = rules.tax(rules.defaultTaxYear());
            double basic = annualIncome * 0.5;
            double empNps = basic * r.newRegime().employerNpsPctOfBasic() / 100;
            double saving = tax.newRegime().totalTax()
                    - taxEngine.totalTax(TaxInput.salary(annualIncome).basicSalary(basic).employerNps(empNps), rules.defaultTaxYear(), true);
            if (saving > 0) moves.add(new TaxMove(r.deduction("employerNps").display(),
                    "Employer NPS via salary restructuring (" + (int) r.newRegime().employerNpsPctOfBasic() + "% of basic)", saving));
            t.assume("Employer NPS estimate assumes basic pay = 50% of salary");
        }
        String regime = oldWinsIfMaxed ? "Old Regime (with full deductions)" : "New Regime";
        t.group("Tax");
        t.step("New regime tax", "on " + Money.inr(annualIncome) + " (income treated as gross)", Money.inr(tax.newRegime().totalTax()));
        t.step("Old regime tax with Sec 123 + NPS + 80D maxed", "", Money.inr(tax.oldRegimeTaxIfMaxed()));
        t.step("Recommended", "lower of the two", regime);
        t.fact("tax.new", tax.newRegime().totalTax());
        t.fact("tax.oldMaxed", tax.oldRegimeTaxIfMaxed());
        moves.forEach(m -> t.fact("taxmove." + m.section(), m.saving()));
        t.assume("Monthly income treated as gross salary for the tax estimate");

        // ── Scenario simulation ────────────────────────────────────────
        var sim = simulate(corpus0, required, years, age, fireNumber, as);
        t.group("Scenario simulation");
        t.step("Success probability", SCENARIOS + " market scenarios (equity σ " + Money.pct(rules.assumption("equityVolatilityPct"))
                + ", debt σ " + Money.pct(rules.assumption("debtVolatilityPct")) + ") at the required SIP", Money.pct(sim.successPct(), 0));
        t.fact("fire.successPct", sim.successPct());

        t.absorb(tax.trace().group("Tax detail"));

        return new FireCalc(age, retireAge, years, as, income, expenses, surplus, annualAtRetire, fireNumber, corpus0,
                sips, required, additional, goalSips, currentRate, requiredRate, yearsToFire,
                yearsToFire > 60 ? -1 : age + yearsToFire, coastAge, feasible, goals, buckets, milestones,
                termCover, healthCover, emergencyTarget, emergencyGap, moves, regime, sim.successPct(), sim.bands(),
                projection, t);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    int equityPct(int yearsLeft) {
        for (JsonNode g : rules.planningNode("glidePath")) {
            if (yearsLeft >= g.path("minYearsLeft").asInt()) return g.path("equityPct").asInt();
        }
        return 30;
    }

    private double blended(Assumptions as, int yearsLeft) {
        double eq = equityPct(yearsLeft) / 100.0;
        return eq * as.equityReturnPct() + (1 - eq) * as.debtReturnPct();
    }

    private List<ProjectionPoint> project(double corpus0, double monthlySip, int horizon, int yearsToRetire,
            Assumptions as, int age, double annualExpensesToday) {
        List<ProjectionPoint> out = new ArrayList<>();
        double c = corpus0, invested = corpus0;
        out.add(new ProjectionPoint(Year.now().getValue(), age, c, targetAt(annualExpensesToday, as, 0), invested));
        for (int y = 1; y <= horizon; y++) {
            double r = blended(as, yearsToRetire - (y - 1)) / 100 / 12;
            for (int m = 0; m < 12; m++) {
                c = c * (1 + r) + monthlySip;
                invested += monthlySip;
            }
            out.add(new ProjectionPoint(Year.now().getValue() + y, age + y, c, targetAt(annualExpensesToday, as, y), invested));
        }
        return out;
    }

    private static double targetAt(double annualExpensesToday, Assumptions as, int y) {
        return Finance.inflate(annualExpensesToday, as.inflationPct(), y) / (as.withdrawalRatePct() / 100);
    }

    private double solveSip(double corpus0, int years, double target, Assumptions as) {
        if (corpus(corpus0, 0, years, as) >= target) return 0;
        double lo = 0, hi = target / 12;
        for (int i = 0; i < 60; i++) {
            double mid = (lo + hi) / 2;
            if (corpus(corpus0, mid, years, as) >= target) hi = mid; else lo = mid;
        }
        return Math.ceil(hi / 100) * 100;
    }

    private double corpus(double corpus0, double sip, int years, Assumptions as) {
        return corpus(corpus0, sip, years, years, as);
    }

    private double corpus(double corpus0, double sip, int horizon, int yearsToRetire, Assumptions as) {
        double c = corpus0;
        for (int y = 1; y <= horizon; y++) {
            double r = blended(as, yearsToRetire - (y - 1)) / 100 / 12;
            for (int m = 0; m < 12; m++) c = c * (1 + r) + sip;
        }
        return c;
    }

    private int yearsUntilFire(double corpus0, double monthly, double annualExpensesToday, Assumptions as, int age) {
        double c = corpus0;
        for (int y = 1; y <= 60; y++) {
            double r = (0.7 * as.equityReturnPct() + 0.3 * as.debtReturnPct()) / 100 / 12;
            for (int m = 0; m < 12; m++) c = c * (1 + r) + monthly;
            double target = Finance.inflate(annualExpensesToday, as.inflationPct(), y) / (as.withdrawalRatePct() / 100);
            if (c >= target) return y;
        }
        return 99;
    }

    private List<Milestone> milestones(List<ProjectionPoint> p, int years, int age, int retireAge, double sip,
            Integer coastAge, double fireNumber, Assumptions as) {
        List<Integer> picks = new ArrayList<>(List.of(1, Math.max(2, years / 4), Math.max(3, years / 2),
                Math.max(4, years * 3 / 4), years));
        if (coastAge != null && coastAge - age > 1 && coastAge - age < years) picks.add(coastAge - age);
        List<Milestone> out = new ArrayList<>();
        picks.stream().distinct().filter(y -> y >= 1 && y <= years).sorted().forEach(y -> {
            var pt = p.get(y);
            int eq = equityPct(years - y);
            String alloc = eq + "% Equity / " + (100 - eq) + "% Debt";
            String action;
            if (y == 1) action = "SIP of " + Money.inr(sip) + "/mo running; emergency fund complete";
            else if (y == years) action = "FIRE: corpus " + Money.compact(pt.corpus()) + " vs target " + Money.compact(fireNumber);
            else if (coastAge != null && y == coastAge - age) action = "Coast FIRE: corpus can reach target without new SIPs";
            else action = "Rebalance to " + alloc;
            out.add(new Milestone(pt.year(), pt.age(), pt.corpus(), action, alloc));
        });
        return out;
    }

    private record SimResult(double successPct, List<Band> bands) {
    }

    private SimResult simulate(double corpus0, double sip, int years, int age, double target, Assumptions as) {
        var rnd = new Random(42); // seeded: identical inputs → identical output
        double eqVol = rules.assumption("equityVolatilityPct");
        double debtVol = rules.assumption("debtVolatilityPct");
        double[][] paths = new double[years + 1][SCENARIOS];
        int success = 0;
        for (int s = 0; s < SCENARIOS; s++) {
            double c = corpus0;
            paths[0][s] = c;
            for (int y = 1; y <= years; y++) {
                double eq = equityPct(years - (y - 1)) / 100.0;
                double re = as.equityReturnPct() + rnd.nextGaussian() * eqVol;
                double rd = as.debtReturnPct() + rnd.nextGaussian() * debtVol;
                double r = eq * re + (1 - eq) * rd;
                c = c * (1 + r / 100) + sip * 12 * (1 + r / 200);
                c = Math.max(0, c);
                paths[y][s] = c;
            }
            if (c >= target) success++;
        }
        List<Band> bands = new ArrayList<>();
        for (int y = 0; y <= years; y++) {
            double[] v = paths[y].clone();
            Arrays.sort(v);
            bands.add(new Band(age + y, v[(int) (SCENARIOS * 0.1)], v[SCENARIOS / 2], v[(int) (SCENARIOS * 0.9)]));
        }
        return new SimResult(success * 100.0 / SCENARIOS, bands);
    }
}
