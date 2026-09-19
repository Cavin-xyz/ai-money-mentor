package ai.money.mentor.backend.engine;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import ai.money.mentor.backend.rules.TaxRules;
import tools.jackson.databind.JsonNode;

/** Deterministic numbers for each life event; the LLM only explains them. */
@Component
public class LifeEventEngine {

    private final TaxEngine taxEngine;
    private final HealthScoreEngine health;
    private final RulesRepository rules;

    public LifeEventEngine(TaxEngine taxEngine, HealthScoreEngine health, RulesRepository rules) {
        this.taxEngine = taxEngine;
        this.health = health;
        this.rules = rules;
    }

    public record Item(String title, double amount, String facts) {
    }

    public record LifeCalc(String eventType, String eventLabel, double amount, double annualIncome,
            double taxLiability, String taxPriority, String taxFacts, List<Item> immediateActions,
            List<Item> longTermAllocation, List<String> checklist, String fireFacts, int healthBefore,
            int healthAfter, boolean profileUsed, CalcTrace trace) {
    }

    public LifeCalc calculate(Map<String, Object> req, Map<String, Object> profile) {
        String type = Inputs.str(req, "eventType", "bonus");
        double amount = Inputs.num(req, "amount");
        if (amount <= 0) throw new IllegalArgumentException("Please enter an amount");
        Map<String, Object> x = Inputs.map(req, "extras");
        boolean profileUsed = profile != null && Inputs.num(profile, "monthlyIncome") > 0;

        double monthlyIncome = Inputs.num(x, "monthlyIncome",
                profileUsed ? Inputs.num(profile, "monthlyIncome") : 0);
        if (monthlyIncome <= 0 && "baby".equals(type)) monthlyIncome = amount; // UI sends monthly income for this event
        if (monthlyIncome <= 0) monthlyIncome = 100_000;
        double annualIncome = monthlyIncome * 12;
        double expenses = profileUsed && Inputs.num(profile, "monthlyExpenses") > 0 ? Inputs.num(profile, "monthlyExpenses") : monthlyIncome * 0.5;
        double emergencyFund = profileUsed ? Inputs.num(profile, "liquidSavings", expenses * 3) : expenses * 3;

        var t = new CalcTrace();
        t.group("Your baseline");
        t.step("Monthly income", profileUsed ? "from your saved profile" : (Inputs.num(x, "monthlyIncome") > 0 ? "entered" : "assumed"), Money.inr(monthlyIncome));
        t.step("Monthly expenses", profileUsed ? "from your saved profile" : "assumed 50% of income", Money.inr(expenses));
        t.fact("base.monthlyIncome", monthlyIncome);
        t.fact("base.annualIncome", annualIncome);
        t.fact("base.expenses", expenses);
        t.fact("amount", amount);
        if (!profileUsed) t.assume("Expenses assumed at 50% of income and emergency fund at 3 months — save a profile for exact numbers");

        Map<String, Object> before = healthInput(profile, monthlyIncome, expenses, emergencyFund);
        Map<String, Object> after = new HashMap<>(before);
        String year = rules.defaultTaxYear();
        TaxRules r = rules.tax(year);
        double emGap = Math.max(0, expenses * rules.planning("emergencyMonths") - emergencyFund);
        t.fact("base.emergencyGap", emGap);

        List<Item> now = new ArrayList<>(), later = new ArrayList<>();
        List<String> checklist = new ArrayList<>();
        double taxLiability;
        String priority, taxFacts, fireFacts, label;

        switch (type) {
            case "bonus" -> {
                label = "Bonus of " + Money.compact(amount);
                t.group("Tax on bonus");
                double without = taxEngine.bestTax(TaxInput.salary(annualIncome), year);
                double with = taxEngine.bestTax(TaxInput.salary(annualIncome + amount), year);
                taxLiability = with - without;
                double net = amount - taxLiability;
                t.step("Tax without bonus", "better regime on " + Money.inr(annualIncome), Money.inr(without));
                t.step("Tax with bonus", "better regime on " + Money.inr(annualIncome + amount), Money.inr(with));
                t.step("Tax on bonus", "difference", Money.inr(taxLiability));
                t.step("Bonus in hand", "bonus − tax", Money.inr(net));
                t.fact("bonus.tax", taxLiability);
                t.fact("bonus.net", net);
                t.fact("bonus.effectiveRate", taxLiability / amount * 100);
                priority = taxLiability / amount > 0.2 ? "HIGH" : taxLiability > 0 ? "MEDIUM" : "LOW";
                taxFacts = "Tax on the bonus is " + Money.inr(taxLiability) + " (" + Money.pct(taxLiability / amount * 100, 0)
                        + " of it); " + Money.inr(net) + " stays in hand.";
                double toEm = Math.min(emGap, net);
                double rest = net - toEm;
                now.add(item(t, "Keep aside for tax", taxLiability, "Usually deducted as TDS; check your payslip"));
                now.add(item(t, "Top up emergency fund", toEm, "Brings the fund towards " + (int) rules.planning("emergencyMonths") + " months of expenses"));
                now.add(item(t, "Park the rest in a liquid fund", rest, "Deploy to long-term investments over 3–6 months"));
                allocate(t, later, rest, 60, 30, 10);
                after.put("liquidSavings", emergencyFund + toEm);
                after.put("retirementCorpus", Inputs.num(before, "retirementCorpus") + rest);
                fireFacts = "Investing " + Money.compact(rest) + " now compounds to " + Money.compact(Finance.fv(rest, rules.assumption("equityReturnPct"), 15)) + " in 15 years at the equity assumption.";
                t.fact("bonus.fv15", Finance.fv(rest, rules.assumption("equityReturnPct"), 15));
                checklist.addAll(List.of("Check TDS on the bonus in your payslip", "Move emergency top-up to a savings/liquid fund",
                        "Set up a 3–6 month STP into equity", "Review whether the old regime now saves more"));
            }
            case "marriage" -> {
                label = "Wedding budget of " + Money.compact(amount);
                taxLiability = 0;
                priority = "LOW";
                taxFacts = "Gifts received on marriage are not taxable; no tax is due on the wedding itself.";
                t.group("Budget split");
                for (JsonNode s : rules.planningNode("marriageBudgetSplit")) {
                    double v = amount * s.path("pct").asDouble() / 100;
                    t.step(s.path("item").asString(), Money.pct(s.path("pct").asDouble(), 0) + " of budget", Money.inr(v));
                    t.fact("wedding." + s.path("item").asString(), v);
                }
                double jointEmergency = expenses * 2 * rules.planning("emergencyMonths");
                t.step("Joint emergency fund", "6 months of combined expenses (≈2 × yours)", Money.inr(jointEmergency));
                t.fact("wedding.jointEmergency", jointEmergency);
                double buffer = amount * 0.10;
                now.add(item(t, "Ring-fence a contingency buffer", buffer, "10% of the budget kept aside for overruns"));
                now.add(item(t, "Build a joint emergency fund", jointEmergency, "Six months of combined household expenses"));
                now.add(item(t, "Family floater health cover", rules.planning("healthCoverTarget"), "Add your spouse; renew as a floater"));
                allocate(t, later, amount * 0.2, 60, 30, 10);
                after.put("liquidSavings", Math.max(0, emergencyFund - amount * 0.3));
                fireFacts = "Combining incomes can raise your savings rate; a " + Money.compact(amount) + " wedding is about " + String.format("%.1f", amount / annualIncome) + " years of your income.";
                t.fact("wedding.incomeYears", amount / annualIncome);
                checklist.addAll(List.of("Update nominees on bank, EPF, insurance and demat", "Add spouse to health insurance",
                        "Decide which partner claims HRA and joint home-loan benefits", "Agree on an expense-split method"));
            }
            case "baby" -> {
                label = "New baby";
                taxLiability = 0;
                priority = "MEDIUM";
                t.group("Protection");
                double term = annualIncome * rules.planning("termCoverMultiple");
                t.step("Term cover to hold", Money.inr(annualIncome) + " × " + (int) rules.planning("termCoverMultiple"), Money.compact(term));
                t.fact("baby.term", term);
                t.group("Education corpus");
                double eduToday = rules.assumption("childEducationCostToday");
                double eduInfl = rules.assumption("educationInflationPct");
                double eduFuture = Finance.inflate(eduToday, eduInfl, 18);
                double eduSip = Finance.sipForTarget(eduFuture, rules.assumption("equityReturnPct"), 18, 0);
                t.step("Degree cost in 18 years", Money.compact(eduToday) + " × (1 + " + Money.pct(eduInfl) + ")^18", Money.compact(eduFuture));
                t.step("Monthly SIP needed", "equity @ " + Money.pct(rules.assumption("equityReturnPct")) + " for 18 years", Money.inr(eduSip));
                t.fact("baby.eduFuture", eduFuture);
                t.fact("baby.eduSip", eduSip);
                t.group("Sukanya Samriddhi (if a daughter)");
                double ssyRate = rules.rule("ssyRatePct");
                double ssyDep = rules.rule("ssyMaxDepositPerYear");
                int depYears = (int) rules.rule("ssyDepositYears"), matYears = (int) rules.rule("ssyMaturityYears");
                double ssy = Finance.fv(Finance.fvSip(ssyDep / 12, ssyRate, depYears), ssyRate, matYears - depYears);
                t.rule("SSY rate", Money.pct(ssyRate) + " (changes quarterly)", rules.ruleSource("ssyRatePct"));
                t.step("Maturity value", Money.inr(ssyDep) + "/yr for " + depYears + " yrs, matures at " + matYears, Money.compact(ssy));
                t.fact("baby.ssy", ssy);
                taxFacts = "Sukanya Samriddhi deposits count under " + r.deduction("sec80C").display()
                        + " (old regime); a baby itself changes no tax.";
                double expenseRise = expenses * 0.15;
                t.fact("baby.expenseRise", expenseRise);
                now.add(item(t, "Raise term life cover to", term, Money.inr(annualIncome) + " × " + (int) rules.planning("termCoverMultiple")));
                now.add(item(t, "Add baby to health floater", rules.planning("healthCoverTarget"), "Most insurers allow mid-term addition"));
                now.add(item(t, "Top up emergency fund", expenseRise * rules.planning("emergencyMonths"), "Expenses typically rise ~15% with a child"));
                later.add(item(t, "Education SIP (equity)", eduSip * 12, Money.inr(eduSip) + "/mo for 18 years"));
                later.add(item(t, "Sukanya Samriddhi (daughter)", ssyDep, "Up to " + Money.inr(ssyDep) + "/yr, government-backed"));
                later.add(item(t, "PPF in child's name", 50_000, "Long-term debt sleeve for the goal"));
                after.put("monthlyExpenses", expenses + expenseRise);
                fireFacts = "Education SIP of " + Money.inr(eduSip) + "/mo is needed alongside your FIRE plan.";
                checklist.addAll(List.of("Get the birth certificate and PAN/Aadhaar for the child", "Add the child as nominee and to health cover",
                        "Start the education SIP", "Write or update your will"));
            }
            case "inheritance" -> {
                label = "Inheritance of " + Money.compact(amount);
                taxLiability = 0;
                priority = "LOW";
                taxFacts = "India has no inheritance tax. Tax arises only later — on rent, interest or capital gains when you sell inherited assets.";
                double em = Math.min(emGap, amount);
                double invest = amount - em;
                now.add(item(t, "Fill the emergency fund", em, "Top up to " + (int) rules.planning("emergencyMonths") + " months first"));
                now.add(item(t, "Clear high-interest debt", Inputs.num(x, "highInterestDebt"), "Credit cards/personal loans before investing"));
                now.add(item(t, "Park the rest in a liquid fund", invest, "Invest gradually over 6–12 months"));
                allocate(t, later, invest, 50, 35, 15);
                after.put("liquidSavings", emergencyFund + em);
                after.put("retirementCorpus", Inputs.num(before, "retirementCorpus") + invest);
                fireFacts = Money.compact(invest) + " invested today could reach " + Money.compact(Finance.fv(invest, 10, 15)) + " in 15 years at 10%.";
                t.fact("inh.invest", invest);
                t.fact("inh.fv15", Finance.fv(invest, 10, 15));
                checklist.addAll(List.of("Transmit assets to your name (succession certificate / probate if needed)",
                        "Record the original owner's purchase cost for future capital-gains tax", "Update nominees", "Stagger equity investment over 6–12 months"));
            }
            case "job_change" -> {
                label = "New CTC of " + Money.compact(amount);
                t.group("Tax on new CTC");
                double basic = amount * 0.4;
                var cmp = taxEngine.compare(TaxInput.salary(amount).basicSalary(basic), year);
                double empNps = basic * r.newRegime().employerNpsPctOfBasic() / 100;
                double withNps = taxEngine.totalTax(TaxInput.salary(amount).basicSalary(basic).employerNps(empNps), year, true);
                taxLiability = Math.min(cmp.oldRegime().totalTax(), cmp.newRegime().totalTax());
                double npsSaving = cmp.newRegime().totalTax() - withNps;
                t.step("New regime tax", "on " + Money.inr(amount), Money.inr(cmp.newRegime().totalTax()));
                t.step("Old regime tax", "no deductions", Money.inr(cmp.oldRegime().totalTax()));
                t.step("Employer NPS " + r.deduction("employerNps").display(), Money.pct(r.newRegime().employerNpsPctOfBasic(), 0) + " of basic (basic assumed 40% of CTC)", Money.inr(empNps) + "/yr");
                t.step("Tax saved via employer NPS", "new-regime tax without − with", Money.inr(npsSaving));
                t.fact("job.tax", taxLiability);
                t.fact("job.empNps", empNps);
                t.fact("job.npsSaving", npsSaving);
                double yrs = Inputs.num(x, "yearsAtEmployer");
                double lastBasicMonthly = Inputs.num(x, "lastBasicMonthly", annualIncome * 0.4 / 12);
                double gratuity = yrs >= rules.rule("gratuityMinYears") ? 15.0 / 26 * lastBasicMonthly * Math.floor(yrs) : 0;
                t.step("Gratuity from old employer", yrs >= rules.rule("gratuityMinYears")
                        ? "15/26 × " + Money.inr(lastBasicMonthly) + " × " + (int) Math.floor(yrs) + " yrs" : "needs " + (int) rules.rule("gratuityMinYears") + "+ years of service", Money.inr(gratuity));
                t.fact("job.gratuity", gratuity);
                priority = npsSaving > 0 ? "HIGH" : "MEDIUM";
                taxFacts = "Tax on the new CTC is about " + Money.inr(taxLiability) + "/yr; asking for employer NPS (" + Money.inr(empNps) + "/yr) cuts it by " + Money.inr(npsSaving) + ".";
                now.add(item(t, "Transfer EPF (don't withdraw)", 0, "Withdrawals before 5 years of service are taxable"));
                now.add(item(t, "Request employer NPS in salary structure", empNps, "Allowed in the new regime too"));
                now.add(item(t, "Gratuity due from old employer", gratuity, yrs > 0 ? (int) Math.floor(yrs) + " years of service" : "Enter years of service to estimate"));
                double hike = amount / 12 - monthlyIncome;
                allocate(t, later, Math.max(0, hike) * 12 * 0.5, 60, 30, 10);
                after.put("monthlyIncome", Math.max(monthlyIncome, (amount - taxLiability) / 12));
                fireFacts = hike > 0 ? "Investing half of the " + Money.inr(hike) + "/mo raise keeps lifestyle creep in check." : "Keep your SIPs unchanged through the switch.";
                t.fact("job.hike", hike);
                checklist.addAll(List.of("Submit Form 12B/previous-employer income to the new employer", "Initiate EPF transfer online (UAN)",
                        "Choose your tax regime with the new employer", "Collect full & final settlement and gratuity"));
            }
            case "home" -> {
                label = "Home worth " + Money.compact(amount);
                t.group("Loan & affordability");
                double ltvCap = 75;
                for (JsonNode tier : rules.ruleNode("homeLoanLtv").path("tiers")) {
                    if (tier.path("upToPrice").isNull() || amount <= tier.path("upToPrice").asDouble()) {
                        ltvCap = tier.path("maxLtvPct").asDouble();
                        break;
                    }
                }
                double downPct = Math.max(100 - ltvCap, Inputs.num(x, "downPaymentPct", 20));
                double loan = amount * (1 - downPct / 100);
                double rate = Inputs.num(x, "loanRatePct", rules.assumption("homeLoanRatePct"));
                int tenure = (int) Inputs.num(x, "tenureYears", 20);
                double emi = Finance.emi(loan, rate, tenure * 12);
                double stamp = amount * rules.assumption("stampDutyPct") / 100;
                double reg = amount * rules.assumption("registrationPct") / 100;
                double upfront = amount * downPct / 100 + stamp + reg;
                double emiRatio = emi / monthlyIncome * 100;
                double interestY1 = Finance.firstYearInterest(loan, rate, tenure * 12);
                t.rule("RBI loan-to-value cap", Money.pct(ltvCap, 0) + " for this price band", rules.ruleNode("homeLoanLtv").path("source").asString());
                t.step("Loan amount", Money.inr(amount) + " × (1 − " + Money.pct(downPct, 0) + " down)", Money.inr(loan));
                t.step("EMI", Money.pct(rate) + " for " + tenure + " years", Money.inr(emi) + "/mo");
                t.step("EMI-to-income", Money.inr(emi) + " ÷ " + Money.inr(monthlyIncome), Money.pct(emiRatio, 0) + " (comfort ≤ " + (int) rules.planning("emiComfortPct") + "%)");
                t.step("Stamp duty + registration", rules.assumptionNote("stampDutyPct"), Money.inr(stamp + reg));
                t.step("Cash needed upfront", "down payment + stamp duty + registration", Money.inr(upfront));
                t.fact("home.loan", loan);
                t.fact("home.emi", emi);
                t.fact("home.emiRatio", emiRatio);
                t.fact("home.upfront", upfront);
                t.fact("home.stamp", stamp + reg);
                t.fact("home.down", amount * downPct / 100);
                t.fact("home.interestY1", interestY1);
                t.group("Tax benefit (old regime)");
                var hl = r.deduction("homeLoanInterest");
                double withLoan = taxEngine.totalTax(TaxInput.salary(annualIncome).homeLoanInterest(interestY1), year, false);
                double withoutLoan = taxEngine.totalTax(TaxInput.salary(annualIncome), year, false);
                double newTax = taxEngine.totalTax(TaxInput.salary(annualIncome), year, true);
                double benefit = Math.max(0, withoutLoan - withLoan);
                t.step("Year-1 interest", "amortisation schedule", Money.inr(interestY1));
                t.step(hl.display() + " deduction", "min(interest, " + Money.inr(hl.limit()) + ")", Money.inr(Math.min(interestY1, hl.limit())));
                t.step("Old-regime tax saved", "tax without − with interest deduction", Money.inr(benefit));
                t.fact("home.taxBenefit", benefit);
                t.fact("home.newTax", newTax);
                t.fact("home.oldTaxWithLoan", withLoan);
                taxLiability = stamp + reg;
                priority = emiRatio > rules.planning("emiComfortPct") ? "HIGH" : "MEDIUM";
                taxFacts = "Stamp duty and registration cost about " + Money.inr(stamp + reg) + ". In the old regime, "
                        + hl.display() + " interest saves " + Money.inr(benefit) + " in year one; the new regime gives no deduction for a self-occupied home.";
                now.add(item(t, "Arrange down payment", amount * downPct / 100, Money.pct(downPct, 0) + " (RBI caps the loan at " + Money.pct(ltvCap, 0) + ")"));
                now.add(item(t, "Stamp duty & registration", stamp + reg, "State-dependent; confirm with your sub-registrar"));
                now.add(item(t, "Monthly EMI", emi, Money.pct(emiRatio, 0) + " of take-home"));
                later.add(item(t, "Keep emergency fund intact", expenses * rules.planning("emergencyMonths"), "Don't drain it for the down payment"));
                later.add(item(t, "Term cover ≥ loan", loan, "So the loan is never a burden on family"));
                later.add(item(t, "Prepay with bonuses", emi * 12 * 0.1, "≈10% of annual EMI a year shortens tenure sharply"));
                after.put("monthlyEmi", Inputs.num(before, "monthlyEmi") + emi);
                after.put("liquidSavings", Math.max(0, emergencyFund - Math.max(0, upfront - Inputs.num(x, "savedForHome"))));
                fireFacts = "An EMI of " + Money.inr(emi) + " for " + tenure + " years reduces what you can invest toward FIRE.";
                checklist.addAll(List.of("Check title, RERA registration and OC", "Compare repo-linked rates from 3 lenders",
                        "Buy term cover at least equal to the loan", "Decide who co-owns and co-borrows for tax benefits"));
            }
            default -> throw new IllegalArgumentException("Unknown event: " + type);
        }

        int hBefore = health.calculate(before).overall();
        int hAfter = health.calculate(after).overall();
        t.group("Health score impact");
        t.step("Health score before", "six-dimension engine on your baseline", hBefore + "/100");
        t.step("Health score after", "same engine after the event's cash-flow changes", hAfter + "/100");
        t.fact("health.before", hBefore);
        t.fact("health.after", hAfter);
        t.fact("taxLiability", taxLiability);

        return new LifeCalc(type, label, amount, annualIncome, taxLiability, priority, taxFacts, now, later, checklist,
                fireFacts, hBefore, hAfter, profileUsed, t);
    }

    private static Item item(CalcTrace t, String title, double amount, String facts) {
        t.fact("item." + title, amount);
        return new Item(title, amount, facts);
    }

    private void allocate(CalcTrace t, List<Item> out, double total, int eq, int debt, int gold) {
        if (total <= 0) {
            out.add(new Item("Keep investing via SIPs", 0, "No lump sum left to allocate"));
            return;
        }
        t.group("Long-term allocation");
        t.step("Equity index funds", Money.pct(eq, 0) + " of " + Money.inr(total), Money.inr(total * eq / 100));
        t.step("Debt (PPF / short-duration funds)", Money.pct(debt, 0) + " of " + Money.inr(total), Money.inr(total * debt / 100));
        t.step("Gold / international", Money.pct(gold, 0) + " of " + Money.inr(total), Money.inr(total * gold / 100));
        out.add(item(t, "Equity index funds", total * eq / 100, eq + "% — long-term growth"));
        out.add(item(t, "Debt: PPF / short-duration funds", total * debt / 100, debt + "% — stability"));
        out.add(item(t, "Gold / international funds", total * gold / 100, gold + "% — diversification"));
    }

    private static Map<String, Object> healthInput(Map<String, Object> profile, double income, double expenses, double liquid) {
        Map<String, Object> h = new HashMap<>();
        h.put("monthlyIncome", income);
        h.put("monthlyExpenses", expenses);
        h.put("liquidSavings", liquid);
        h.put("dependents", profile != null ? profile.getOrDefault("dependents", "No") : "No");
        h.put("lifeCover", profile != null ? profile.getOrDefault("lifeCover", 0) : 0);
        h.put("healthCover", profile != null ? profile.getOrDefault("healthCover", 500_000) : 500_000);
        h.put("investOutsideFd", "Yes");
        h.put("equityPct", 60);
        h.put("monthlyEmi", profile != null ? profile.getOrDefault("monthlyEmi", 0) : 0);
        h.put("currentAge", profile != null ? profile.getOrDefault("age", 30) : 30);
        h.put("targetRetirementAge", 60);
        h.put("retirementCorpus", profile != null ? profile.getOrDefault("retirementCorpus", income * 12) : income * 12);
        return h;
    }
}
