package ai.money.mentor.backend.engine;

/** Annual figures for one individual. Fluent setters keep call sites readable. */
public class TaxInput {

    double grossSalary;
    double otherIncome;
    double sec80C;
    double sec80D;
    double sec80DParents;
    double sec80CCD1B;
    double employerNps;
    double basicSalary;
    double hraReceived;
    double rentPaid;
    boolean metro = true;
    double homeLoanInterest;
    double professionalTax;
    /** Extra generic deduction (old regime) — used internally for break-even search. */
    double extraOldDeduction;

    public static TaxInput salary(double annualGross) {
        var in = new TaxInput();
        in.grossSalary = Math.max(0, annualGross);
        return in;
    }

    public TaxInput copy() {
        var c = new TaxInput();
        c.grossSalary = grossSalary;
        c.otherIncome = otherIncome;
        c.sec80C = sec80C;
        c.sec80D = sec80D;
        c.sec80DParents = sec80DParents;
        c.sec80CCD1B = sec80CCD1B;
        c.employerNps = employerNps;
        c.basicSalary = basicSalary;
        c.hraReceived = hraReceived;
        c.rentPaid = rentPaid;
        c.metro = metro;
        c.homeLoanInterest = homeLoanInterest;
        c.professionalTax = professionalTax;
        c.extraOldDeduction = extraOldDeduction;
        return c;
    }

    public TaxInput otherIncome(double v) { otherIncome = Math.max(0, v); return this; }
    public TaxInput sec80C(double v) { sec80C = Math.max(0, v); return this; }
    public TaxInput sec80D(double v) { sec80D = Math.max(0, v); return this; }
    public TaxInput sec80DParents(double v) { sec80DParents = Math.max(0, v); return this; }
    public TaxInput sec80CCD1B(double v) { sec80CCD1B = Math.max(0, v); return this; }
    public TaxInput employerNps(double v) { employerNps = Math.max(0, v); return this; }
    public TaxInput basicSalary(double v) { basicSalary = Math.max(0, v); return this; }
    public TaxInput hra(double received, double rent, boolean isMetro) {
        hraReceived = Math.max(0, received);
        rentPaid = Math.max(0, rent);
        metro = isMetro;
        return this;
    }
    public TaxInput homeLoanInterest(double v) { homeLoanInterest = Math.max(0, v); return this; }
    public TaxInput professionalTax(double v) { professionalTax = Math.max(0, v); return this; }

    public double grossSalary() { return grossSalary; }
    public double otherIncome() { return otherIncome; }
    public double sec80C() { return sec80C; }
    public double sec80D() { return sec80D; }
    public double sec80CCD1B() { return sec80CCD1B; }
    public double homeLoanInterest() { return homeLoanInterest; }
    public double rentPaid() { return rentPaid; }

    /** Basic salary if known, else the common 50%-of-gross structure (shown as an assumption). */
    double effectiveBasic() {
        return basicSalary > 0 ? basicSalary : grossSalary * 0.5;
    }
}
