package ai.money.mentor.backend.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import ai.money.mentor.backend.rules.TaxRules;

/**
 * Cross-income optimisation for two partners. Every saving is computed by re-running the
 * tax engine with and without the move, under whichever regime is cheaper for that partner.
 */
@Component
public class CoupleOptimizer {

    private final TaxEngine taxEngine;
    private final RulesRepository rules;

    public CoupleOptimizer(TaxEngine taxEngine, RulesRepository rules) {
        this.taxEngine = taxEngine;
        this.rules = rules;
    }

    public record PartnerResult(String name, double monthlySalary, double annualGross, double oldTax, double newTax,
            String bestRegime, double bestTax, double marginalRatePct, double monthlyTakeHome) {
    }

    public record Insight(String key, String category, String impactLabel, String impactType, double saving,
            String facts) {
    }

    public record Split(String key, String label, double partner1, double partner2, double leftover1,
            double leftover2) {
    }

    public record CoupleCalc(List<PartnerResult> partners, List<Insight> insights, List<Split> splits,
            double sharedExpenses, double householdTaxNow, double householdTaxOptimized, CalcTrace trace) {
    }

    private record P(String name, double monthly, double decl80C, double investments, double rent,
            double healthPremium, double nps) {
        TaxInput base() {
            return TaxInput.salary(monthly * 12).sec80C(decl80C).sec80D(healthPremium).sec80CCD1B(nps);
        }
    }

    public CoupleCalc calculate(Map<String, Object> req) {
        String year = rules.defaultTaxYear();
        TaxRules r = rules.tax(year);
        var t = new CalcTrace();
        Map<String, Object> m1 = Inputs.map(req, "partner1");
        Map<String, Object> m2 = Inputs.map(req, "partner2");
        P p1 = partner(m1, "Partner 1");
        P p2 = partner(m2, "Partner 2");
        if (p1.monthly() <= 0 || p2.monthly() <= 0) throw new IllegalArgumentException("Please enter salary for both partners");
        boolean jointLoan = Inputs.yes(req, "jointHomeLoan");
        double loanInterest = Inputs.num(req, "homeLoanInterest");

        List<PartnerResult> results = new ArrayList<>();
        for (P p : List.of(p1, p2)) {
            var cmp = taxEngine.compare(p.base(), year);
            double best = Math.min(cmp.oldRegime().totalTax(), cmp.newRegime().totalTax());
            String regime = cmp.oldRegime().totalTax() < cmp.newRegime().totalTax() ? "Old" : "New";
            double marginal = "Old".equals(regime) ? cmp.oldRegime().marginalRatePct() : cmp.newRegime().marginalRatePct();
            results.add(new PartnerResult(p.name(), p.monthly(), p.monthly() * 12, cmp.oldRegime().totalTax(),
                    cmp.newRegime().totalTax(), regime, best, marginal, p.monthly() - best / 12));
            t.group(p.name());
            t.step("Annual gross", Money.inr(p.monthly()) + " × 12", Money.inr(p.monthly() * 12));
            t.step("Old regime tax", "with declared deductions", Money.inr(cmp.oldRegime().totalTax()));
            t.step("New regime tax", "standard deduction only", Money.inr(cmp.newRegime().totalTax()));
            t.step("Better regime", "lower tax", regime + " · " + Money.inr(best));
            t.step("Marginal rate", "tax on the next ₹10,000 of income", Money.pct(marginal, 1));
            String k = p == p1 ? "p1" : "p2";
            t.fact(k + ".bestTax", best);
            t.fact(k + ".oldTax", cmp.oldRegime().totalTax());
            t.fact(k + ".newTax", cmp.newRegime().totalTax());
            t.fact(k + ".gross", p.monthly() * 12);
            t.fact(k + ".marginal", marginal);
            t.fact(k + ".takeHome", p.monthly() - best / 12);
        }
        double taxNow = results.get(0).bestTax() + results.get(1).bestTax();

        // ── Candidate moves, each with a recomputed saving ─────────────
        List<Insight> candidates = new ArrayList<>();
        t.group("Optimisation moves");
        for (P p : List.of(p1, p2)) {
            double now = taxEngine.bestTax(p.base(), year);
            var sec123 = r.deduction("sec80C");
            double s80c = now - taxEngine.bestTax(p.base().sec80C(sec123.limit()), year);
            t.fact("headroom123." + p.name(), sec123.limit() - Math.min(p.decl80C(), sec123.limit()));
            if (s80c > 0) candidates.add(record(t, new Insight("80c-" + p.name(), sec123.display() + " top-up for " + p.name(),
                    "High Impact", "high", s80c, p.name() + " has " + Money.inr(sec123.limit() - Math.min(p.decl80C(), sec123.limit()))
                            + " of " + sec123.display() + " headroom; filling it saves " + Money.inr(s80c) + "/yr in the old regime")));
            var nps = r.deduction("sec80CCD1B");
            double sNps = now - taxEngine.bestTax(p.base().sec80CCD1B(nps.limit()), year);
            if (sNps > 0) candidates.add(record(t, new Insight("nps-" + p.name(), "NPS " + nps.display() + " for " + p.name(),
                    "Retirement Boost", "retirement", sNps, p.name() + " investing " + Money.inr(nps.limit())
                            + "/yr in NPS cuts tax by " + Money.inr(sNps) + " while building retirement savings")));
            // Employer NPS is the one deduction the new regime still allows
            var emp = r.deduction("employerNps");
            double basic = p.monthly() * 12 * 0.5;
            double empNps = basic * r.newRegime().employerNpsPctOfBasic() / 100;
            double newNow = taxEngine.totalTax(p.base(), year, true);
            double newWith = taxEngine.totalTax(p.base().basicSalary(basic).employerNps(empNps), year, true);
            double sEmp = Math.min(now, newNow) - Math.min(newWith, taxEngine.totalTax(p.base(), year, false));
            t.fact("empnps." + p.name(), empNps);
            if (sEmp > 0) candidates.add(record(t, new Insight("empnps-" + p.name(), "Employer NPS " + emp.display() + " for " + p.name(),
                    "Retirement Boost", "retirement", sEmp, "Routing " + Money.inr(empNps) + "/yr of " + p.name()
                            + "'s salary into employer NPS (" + (int) r.newRegime().employerNpsPctOfBasic() + "% of basic) cuts tax by "
                            + Money.inr(sEmp) + " — allowed even in the new regime")));
            var d = r.deduction("sec80D");
            if (p.healthPremium() < d.limit()) {
                double sD = now - taxEngine.bestTax(p.base().sec80D(d.limit()), year);
                if (sD > 0) candidates.add(record(t, new Insight("80d-" + p.name(), "Health cover " + d.display() + " for " + p.name(),
                        "High Impact", "high", sD, p.name() + " paying a " + Money.inr(d.limit()) + " health premium saves "
                                + Money.inr(sD) + "/yr in tax")));
            }
        }

        // Route debt investments through the lower-bracket partner
        PartnerResult hi = results.get(0).marginalRatePct() >= results.get(1).marginalRatePct() ? results.get(0) : results.get(1);
        PartnerResult lo = hi == results.get(0) ? results.get(1) : results.get(0);
        double monthlyInvest = p1.investments() + p2.investments();
        double debtIncome = monthlyInvest * 12 * 0.3 * rules.assumption("debtReturnPct") / 100;
        double routing = debtIncome * (hi.marginalRatePct() - lo.marginalRatePct()) / 100;
        t.fact("routing.debtIncome", debtIncome);
        if (routing > 0 && monthlyInvest > 0) {
            candidates.add(record(t, new Insight("routing", "Hold debt investments in " + lo.name() + "'s name", "Portfolio Optimization",
                    "portfolio", routing, "Interest on the debt share (≈" + Money.inr(debtIncome) + "/yr) is taxed at "
                            + Money.pct(lo.marginalRatePct(), 0) + " for " + lo.name() + " vs " + Money.pct(hi.marginalRatePct(), 0)
                            + " for " + hi.name() + ". " + lo.name() + " must invest their own income — money gifted by a spouse is clubbed back.")));
        }

        // Joint home loan: both co-owners claim interest (old regime, self-occupied)
        if (jointLoan && loanInterest > 0) {
            var hl = r.deduction("homeLoanInterest");
            double single = taxEngine.bestTax(p1.base().homeLoanInterest(loanInterest), year) + taxEngine.bestTax(p2.base(), year);
            double shared = taxEngine.bestTax(p1.base().homeLoanInterest(loanInterest / 2), year)
                    + taxEngine.bestTax(p2.base().homeLoanInterest(loanInterest / 2), year);
            double s = single - shared;
            if (s > 0) candidates.add(record(t, new Insight("joint-loan", "Joint home loan " + hl.display(), "High Impact", "high", s,
                    "Splitting " + Money.inr(loanInterest) + " of interest lets each co-owner claim up to " + Money.inr(hl.limit())
                            + ", saving " + Money.inr(s) + "/yr versus one claimant")));
        }

        // HRA: the partner in the higher bracket claims the rent (assumed HRA structure)
        double rent = Math.max(p1.rent(), p2.rent());
        if (rent > 0) {
            P hiP = hi.name().equals(p1.name()) ? p1 : p2;
            P loP = hiP == p1 ? p2 : p1;
            double basicHi = hiP.monthly() * 12 * 0.5, basicLo = loP.monthly() * 12 * 0.5;
            double hiClaims = taxEngine.bestTax(hiP.base().basicSalary(basicHi).hra(basicHi * 0.4, rent * 12, true), year)
                    + taxEngine.bestTax(loP.base(), year);
            double loClaims = taxEngine.bestTax(loP.base().basicSalary(basicLo).hra(basicLo * 0.4, rent * 12, true), year)
                    + taxEngine.bestTax(hiP.base(), year);
            double s = loClaims - hiClaims;
            if (s > 0) candidates.add(record(t, new Insight("hra", "HRA claimed by " + hiP.name(), "High Impact", "high", s,
                    "If " + hiP.name() + " pays and claims the " + Money.inr(rent) + "/mo rent, the household saves " + Money.inr(s)
                            + "/yr (assumes basic = 50% of salary and HRA = 40% of basic)")));
            t.assume("HRA estimate assumes basic pay = 50% of salary and HRA = 40% of basic, metro city");
        }

        candidates.sort(Comparator.comparingDouble(Insight::saving).reversed());
        List<Insight> top = new ArrayList<>(candidates.stream().limit(3).toList());
        if (top.size() < 3) {
            boolean same = results.get(0).bestRegime().equals(results.get(1).bestRegime());
            top.add(new Insight("regimes", "Pick regimes independently", "High Impact", "high", 0, same
                    ? "Both of you pay less in the " + results.get(0).bestRegime() + " regime. Each spouse chooses separately every year, so re-check after a raise or a new home loan"
                    : p1.name() + " is better off in the " + results.get(0).bestRegime() + " regime and " + p2.name()
                            + " in the " + results.get(1).bestRegime() + " regime — each spouse chooses separately"));
        }
        if (top.size() < 3) {
            var split = c3(results);
            top.add(new Insight("split", "Split shared costs by income", "Portfolio Optimization", "portfolio", 0, split));
        }
        double optimized = taxNow - top.stream().mapToDouble(Insight::saving).sum();
        t.group("Household");
        t.step("Household tax now", "both partners in their better regime", Money.inr(taxNow));
        t.step("After top moves", "now − savings", Money.inr(optimized));
        t.fact("household.taxNow", taxNow);
        t.fact("household.taxOptimized", optimized);
        t.fact("household.saving", taxNow - optimized);

        // ── Expense splits ─────────────────────────────────────────────
        double net1 = results.get(0).monthlyTakeHome(), net2 = results.get(1).monthlyTakeHome();
        double shared = Inputs.num(req, "sharedExpenses", (net1 + net2) * 0.4);
        double prop1 = shared * net1 / (net1 + net2);
        double leftover1 = Finance.clamp((net1 - net2 + shared) / 2, 0, shared);
        List<Split> splits = List.of(
                new Split("equal", "50 / 50", shared / 2, shared / 2, net1 - shared / 2, net2 - shared / 2),
                new Split("proportional", "Proportional to income", prop1, shared - prop1, net1 - prop1, net2 - (shared - prop1)),
                new Split("equalLeftover", "Equal money left over", leftover1, shared - leftover1, net1 - leftover1, net2 - (shared - leftover1)));
        t.group("Expense split");
        t.step("Shared monthly expenses", Inputs.num(req, "sharedExpenses") > 0 ? "entered" : "assumed 40% of combined take-home", Money.inr(shared));
        t.step("Proportional share of " + p1.name(), Money.inr(shared) + " × " + Money.pct(net1 / (net1 + net2) * 100, 0), Money.inr(prop1));
        t.fact("split.shared", shared);
        for (var s : splits) {
            t.fact("split." + s.key() + ".p1", s.partner1());
            t.fact("split." + s.key() + ".p2", s.partner2());
        }

        return new CoupleCalc(results, top, splits, shared, taxNow, optimized, t);
    }

    private static String c3(List<PartnerResult> r) {
        double a = r.get(0).monthlyTakeHome(), b = r.get(1).monthlyTakeHome();
        long pa = Math.round(a / (a + b) * 100);
        return r.get(0).name() + " takes home " + Money.inr(a) + " and " + r.get(1).name() + " " + Money.inr(b)
                + " a month; sharing common costs about " + pa + ":" + (100 - pa) + " keeps savings fair for both — compare the split options below";
    }

    private static Insight record(CalcTrace t, Insight i) {
        t.step(i.category(), "tax without move − tax with move", Money.inr(i.saving()) + "/yr");
        t.fact("insight." + i.key(), i.saving());
        return i;
    }

    private static P partner(Map<String, Object> m, String fallback) {
        return new P(Inputs.str(m, "name", fallback), Inputs.num(m, "salary"), Inputs.num(m, "declarations80C"),
                Inputs.num(m, "investments"), Inputs.num(m, "rent"), Inputs.num(m, "healthPremium"), Inputs.num(m, "nps"));
    }
}
