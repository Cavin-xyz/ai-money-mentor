package ai.money.mentor.backend.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import ai.money.mentor.backend.rules.TaxRules;
import ai.money.mentor.backend.rules.TaxRules.Regime;

/**
 * Deterministic income-tax calculator for resident individuals below 60: old vs new regime,
 * rebate with marginal relief, surcharge with marginal relief, 4% cess, rounding to ₹10.
 * All numbers the app shows about tax come from here — never from the LLM.
 */
@Component
public class TaxEngine {

    private final RulesRepository rules;

    public TaxEngine(RulesRepository rules) {
        this.rules = rules;
    }

    public record SlabLine(double from, Double to, double ratePct, double taxable, double tax) {
    }

    public record DeductionLine(String key, String label, String section, double claimed, Double limit) {
    }

    public record RegimeResult(String regime, String label, double grossIncome, double standardDeduction,
            List<DeductionLine> deductions, double totalDeductions, double taxableIncome, double slabTax,
            List<SlabLine> slabs, double rebate, double marginalRelief, double surcharge, double cess,
            double totalTax, double effectiveRatePct, double marginalRatePct) {
    }

    public record DeductionGap(String key, String label, String section, double claimed, double limit,
            double headroom, double oldRegimeSaving) {
    }

    public record TaxComparison(String taxYear, String taxYearLabel, String act, RegimeResult oldRegime,
            RegimeResult newRegime, String winner, double savings, List<DeductionGap> gaps,
            double oldRegimeTaxIfMaxed, double breakEvenExtraDeductions, CalcTrace trace) {

        public RegimeResult better() {
            return "old".equals(winner) ? oldRegime : newRegime;
        }
    }

    public TaxComparison compare(TaxInput in, String taxYear) {
        TaxRules r = rules.tax(taxYear);
        var trace = new CalcTrace();
        var oldR = compute(in, r, false, trace);
        var newR = compute(in, r, true, trace);

        String winner = oldR.totalTax() < newR.totalTax() ? "old"
                : newR.totalTax() < oldR.totalTax() ? "new" : "equal";
        double savings = Math.abs(oldR.totalTax() - newR.totalTax());

        List<DeductionGap> gaps = new ArrayList<>();
        addGap(gaps, in, r, oldR.totalTax(), "sec80C", in.sec80C, c -> c.sec80C(r.deduction("sec80C").limit()));
        addGap(gaps, in, r, oldR.totalTax(), "sec80CCD1B", in.sec80CCD1B, c -> c.sec80CCD1B(r.deduction("sec80CCD1B").limit()));
        addGap(gaps, in, r, oldR.totalTax(), "sec80D", in.sec80D, c -> c.sec80D(r.deduction("sec80D").limit()));

        TaxInput maxed = in.copy()
                .sec80C(Math.max(in.sec80C, r.deduction("sec80C").limit()))
                .sec80CCD1B(Math.max(in.sec80CCD1B, r.deduction("sec80CCD1B").limit()))
                .sec80D(Math.max(in.sec80D, r.deduction("sec80D").limit()));
        double oldIfMaxed = totalTax(maxed, r, false);
        double breakEven = breakEvenExtraDeductions(in, r, newR.totalTax(), oldR.totalTax());

        trace.group("Verdict");
        trace.step("Better regime for you", "min(old total, new total)",
                "equal".equals(winner) ? "Both equal" : ("old".equals(winner) ? r.oldRegime().name() : r.newRegime().name())
                        + " saves " + Money.inr(savings));
        trace.fact("tax.savings", savings);
        trace.fact("tax.oldIfMaxed", oldIfMaxed);
        if (breakEven > 0) {
            trace.step("Old regime break-even", "extra deductions needed for old ≤ new", Money.inr(breakEven));
            trace.fact("tax.breakEven", breakEven);
        }
        for (var g : gaps) {
            trace.fact("gap." + g.key() + ".headroom", g.headroom());
            trace.fact("gap." + g.key() + ".saving", g.oldRegimeSaving());
        }
        trace.assume("Resident individual below 60; salary income" + (in.basicSalary > 0 ? "" : "; basic pay assumed at 50% of gross"));

        return new TaxComparison(r.taxYear(), r.label(), r.act(), oldR, newR, winner, savings, gaps, oldIfMaxed,
                breakEven, trace);
    }

    public TaxComparison compare(TaxInput in) {
        return compare(in, rules.defaultTaxYear());
    }

    /** Total tax only (no trace) — used for what-ifs such as bonus tax or deduction savings. */
    public double totalTax(TaxInput in, String taxYear, boolean newRegime) {
        return totalTax(in, rules.tax(taxYear), newRegime);
    }

    /** Tax under whichever regime is cheaper for this input. */
    public double bestTax(TaxInput in, String taxYear) {
        TaxRules r = rules.tax(taxYear);
        return Math.min(totalTax(in, r, true), totalTax(in, r, false));
    }

    double totalTax(TaxInput in, TaxRules r, boolean newRegime) {
        return compute(in, r, newRegime, null).totalTax();
    }

    private interface Filler {
        TaxInput apply(TaxInput c);
    }

    private void addGap(List<DeductionGap> gaps, TaxInput in, TaxRules r, double currentOldTax, String key,
            double claimed, Filler fill) {
        var d = r.deduction(key);
        double limit = d.limit() == null ? 0 : d.limit();
        double headroom = Math.max(0, limit - claimed);
        if (headroom <= 0) return;
        double saving = currentOldTax - totalTax(fill.apply(in.copy()), r, false);
        gaps.add(new DeductionGap(key, d.label(), d.display(), claimed, limit, headroom, Math.max(0, saving)));
    }

    /** Smallest extra old-regime deduction that makes the old regime no costlier than the new one. */
    private double breakEvenExtraDeductions(TaxInput in, TaxRules r, double newTax, double oldTax) {
        if (oldTax <= newTax) return 0;
        double lo = 0, hi = in.grossSalary + in.otherIncome;
        TaxInput probe = in.copy();
        probe.extraOldDeduction = hi;
        if (totalTax(probe, r, false) > newTax) return 0; // cannot break even
        for (int i = 0; i < 40 && hi - lo > 100; i++) {
            double mid = (lo + hi) / 2;
            probe.extraOldDeduction = mid;
            if (totalTax(probe, r, false) <= newTax) hi = mid; else lo = mid;
        }
        return Math.ceil(hi / 1000) * 1000;
    }

    private RegimeResult compute(TaxInput in, TaxRules r, boolean isNew, CalcTrace trace) {
        Regime regime = isNew ? r.newRegime() : r.oldRegime();
        String key = isNew ? "new" : "old";
        if (trace != null) trace.group(regime.name());

        double gross = in.grossSalary + in.otherIncome;
        double std = in.grossSalary > 0 ? Math.min(regime.standardDeduction(), in.grossSalary) : 0;

        List<DeductionLine> lines = new ArrayList<>();
        double basic = in.effectiveBasic();
        if (isNew) {
            double empNps = Math.min(in.employerNps, basic * regime.employerNpsPctOfBasic() / 100);
            addLine(lines, r, "employerNps", empNps, null);
        } else {
            addLine(lines, r, "professionalTax", Math.min(in.professionalTax, limitOf(r, "professionalTax")), limitOf(r, "professionalTax"));
            if (in.hraReceived > 0 && in.rentPaid > 0) {
                double hra = Math.max(0, Math.min(in.hraReceived,
                        Math.min(in.rentPaid - 0.1 * basic, (in.metro ? 0.5 : 0.4) * basic)));
                addLine(lines, r, "hra", hra, null);
            }
            addLine(lines, r, "homeLoanInterest", Math.min(in.homeLoanInterest, limitOf(r, "homeLoanInterest")), limitOf(r, "homeLoanInterest"));
            addLine(lines, r, "sec80C", Math.min(in.sec80C, limitOf(r, "sec80C")), limitOf(r, "sec80C"));
            addLine(lines, r, "sec80D", Math.min(in.sec80D, limitOf(r, "sec80D")), limitOf(r, "sec80D"));
            addLine(lines, r, "sec80DParents", Math.min(in.sec80DParents, limitOf(r, "sec80DParents")), limitOf(r, "sec80DParents"));
            addLine(lines, r, "sec80CCD1B", Math.min(in.sec80CCD1B, limitOf(r, "sec80CCD1B")), limitOf(r, "sec80CCD1B"));
            double empNps = Math.min(in.employerNps, basic * regime.employerNpsPctOfBasic() / 100);
            addLine(lines, r, "employerNps", empNps, null);
        }
        double deductions = lines.stream().mapToDouble(DeductionLine::claimed).sum()
                + (isNew ? 0 : in.extraOldDeduction);

        double taxable = roundTo(Math.max(0, gross - std - deductions), 10);

        // Progressive slabs
        List<SlabLine> slabLines = new ArrayList<>();
        BigDecimal slabTax = BigDecimal.ZERO;
        double prev = 0;
        for (var s : regime.slabs()) {
            double upper = s.upTo() == null ? Double.MAX_VALUE : s.upTo();
            if (taxable > prev) {
                double inSlab = Math.min(taxable, upper) - prev;
                BigDecimal t = bd(inSlab).multiply(bd(s.ratePct())).divide(bd(100), 2, RoundingMode.HALF_UP);
                slabTax = slabTax.add(t);
                slabLines.add(new SlabLine(prev, s.upTo(), s.ratePct(), inSlab, t.doubleValue()));
            }
            prev = upper;
            if (taxable <= upper) break;
        }

        // Rebate (Sec 156 / formerly 87A) and marginal relief around the rebate threshold
        var rb = regime.rebate();
        double rebate = 0, relief = 0;
        double tax = slabTax.doubleValue();
        if (taxable <= rb.incomeLimit()) {
            rebate = Math.min(tax, rb.maxRebate());
        } else if (rb.marginalRelief()) {
            double excess = taxable - rb.incomeLimit();
            if (tax > excess) relief = tax - excess;
        }
        double afterRebate = tax - rebate - relief;

        // Surcharge with marginal relief at each threshold
        double surcharge = 0;
        List<TaxRules.Surcharge> tiers = regime.surcharge();
        for (int i = tiers.size() - 1; i >= 0; i--) {
            var tier = tiers.get(i);
            if (taxable > tier.above()) {
                surcharge = afterRebate * tier.ratePct() / 100;
                double prevRate = i == 0 ? 0 : tiers.get(i - 1).ratePct();
                double taxAtThreshold = slabTaxOn(tier.above(), regime) * (1 + prevRate / 100);
                double cap = taxAtThreshold + (taxable - tier.above());
                if (afterRebate + surcharge > cap) surcharge = Math.max(0, cap - afterRebate);
                break;
            }
        }

        double cess = (afterRebate + surcharge) * r.cessPct() / 100;
        double total = roundTo(afterRebate + surcharge + cess, r.roundTaxToNearest());
        double effective = gross > 0 ? total / gross * 100 : 0;

        double marginal = 0;
        if (trace != null) { // only for the headline result, avoids recursion blow-up
            TaxInput bumped = in.copy();
            bumped.otherIncome += 10_000;
            marginal = (compute(bumped, r, isNew, null).totalTax() - total) / 10_000 * 100;
        }

        if (trace != null) {
            trace.rule("Tax year", r.label() + " · " + r.act(), r.primarySourceUrl());
            trace.step("Gross income", "salary + other income", Money.inr(gross));
            if (std > 0) trace.rule("Standard deduction", Money.inr(std), regime.source());
            for (var l : lines) {
                trace.step(l.label() + " · " + l.section(), l.limit() == null ? "claimed" : "min(claimed, " + Money.inr(l.limit()) + ")", Money.inr(l.claimed()));
            }
            trace.step("Taxable income", "gross − standard deduction − deductions (rounded to ₹10)", Money.inr(taxable));
            for (var sl : slabLines) {
                String band = Money.compact(sl.from()) + "–" + (sl.to() == null ? "above" : Money.compact(sl.to()));
                trace.step("Slab " + band + " @ " + Money.pct(sl.ratePct()), Money.inr(sl.taxable()) + " × " + Money.pct(sl.ratePct()), Money.inr(sl.tax()));
            }
            if (rebate > 0) trace.rule("Rebate · Sec " + rb.section() + (rb.formerSection() == null ? "" : " (formerly " + rb.formerSection() + ")"),
                    "−" + Money.inr(rebate) + " (income ≤ " + Money.compact(rb.incomeLimit()) + ")", regime.source());
            if (relief > 0) trace.step("Marginal relief on rebate", "tax limited to income above " + Money.compact(rb.incomeLimit()), "−" + Money.inr(relief));
            if (surcharge > 0) trace.step("Surcharge", "on tax above threshold (with marginal relief)", Money.inr(surcharge));
            trace.step("Health & education cess", Money.pct(r.cessPct()) + " of tax + surcharge", Money.inr(cess));
            trace.step("Total tax", "rounded to nearest ₹" + r.roundTaxToNearest(), Money.inr(total));

            trace.fact(key + ".gross", gross);
            trace.fact(key + ".taxable", taxable);
            trace.fact(key + ".deductions", deductions + std);
            trace.fact(key + ".slabTax", tax);
            trace.fact(key + ".rebate", rebate);
            trace.fact(key + ".cess", cess);
            trace.fact(key + ".totalTax", total);
            trace.fact(key + ".monthlyTax", total / 12);
            trace.fact(key + ".effectiveRate", effective);
            trace.fact(key + ".marginalRate", marginal);
        }

        return new RegimeResult(key, regime.display(), gross, std, lines, deductions + std, taxable,
                tax, slabLines, rebate, relief, surcharge, cess, total, effective, marginal);
    }

    private static double slabTaxOn(double income, Regime regime) {
        double tax = 0, prev = 0;
        for (var s : regime.slabs()) {
            double upper = s.upTo() == null ? Double.MAX_VALUE : s.upTo();
            if (income > prev) tax += (Math.min(income, upper) - prev) * s.ratePct() / 100;
            prev = upper;
        }
        return tax;
    }

    private static void addLine(List<DeductionLine> lines, TaxRules r, String key, double claimed, Double limit) {
        if (claimed <= 0) return;
        var d = r.deduction(key);
        lines.add(new DeductionLine(key, d.label(), d.display(), claimed, limit));
    }

    private static double limitOf(TaxRules r, String key) {
        Double l = r.deduction(key).limit();
        return l == null ? Double.MAX_VALUE : l;
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }

    private static double roundTo(double v, int nearest) {
        return BigDecimal.valueOf(v).divide(BigDecimal.valueOf(nearest), 0, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(nearest)).doubleValue();
    }
}
