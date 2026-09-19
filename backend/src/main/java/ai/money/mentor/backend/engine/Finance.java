package ai.money.mentor.backend.engine;

/** Time-value-of-money helpers. Rates are annual percentages. */
public final class Finance {

    private Finance() {
    }

    public static double fv(double presentValue, double annualRatePct, double years) {
        return presentValue * Math.pow(1 + annualRatePct / 100, years);
    }

    /** Future value of a monthly SIP invested at the start of each month. */
    public static double fvSip(double monthly, double annualRatePct, double years) {
        double i = annualRatePct / 100 / 12;
        double n = years * 12;
        if (i == 0) return monthly * n;
        return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    }

    /** Monthly SIP needed to reach {@code target} in {@code years}, given a lump sum already invested. */
    public static double sipForTarget(double target, double annualRatePct, double years, double existingLumpSum) {
        double remaining = target - fv(existingLumpSum, annualRatePct, years);
        if (remaining <= 0) return 0;
        double factor = fvSip(1, annualRatePct, years);
        return factor <= 0 ? remaining : remaining / factor;
    }

    public static double emi(double principal, double annualRatePct, int months) {
        double i = annualRatePct / 100 / 12;
        if (i == 0) return principal / months;
        double p = Math.pow(1 + i, months);
        return principal * i * p / (p - 1);
    }

    /** Interest paid in the first 12 months of an amortising loan. */
    public static double firstYearInterest(double principal, double annualRatePct, int months) {
        double emi = emi(principal, annualRatePct, months);
        double i = annualRatePct / 100 / 12;
        double bal = principal, interest = 0;
        for (int m = 0; m < Math.min(12, months); m++) {
            double in = bal * i;
            interest += in;
            bal -= emi - in;
        }
        return interest;
    }

    public static double inflate(double today, double inflationPct, double years) {
        return fv(today, inflationPct, years);
    }

    public static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
