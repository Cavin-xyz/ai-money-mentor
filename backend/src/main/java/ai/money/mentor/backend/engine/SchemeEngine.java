package ai.money.mentor.backend.engine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.JsonNode;

/**
 * Matches a person against government schemes, deterministically.
 *
 * <p>The point of this module is the user who does not know a scheme exists: every rule here is a
 * plain predicate over the profile (age, income, dependents, children, EPF, senior parents), so the
 * answer is the same every time and can be shown as a formula. The model only writes the sentence
 * that explains a match — it never decides eligibility.
 */
@Service
public class SchemeEngine {

    /** A scheme the person qualifies for (or nearly does), with what it costs and what it gives. */
    public record Match(String id, String name, String shortName, String category, String what, String status,
            String reason, double annualCost, double benefit, String section, String action,
            String authority, String source, boolean confirmed) {
    }

    public record SchemeCalc(List<Match> eligible, List<Match> notEligible, double totalAnnualCost,
            double totalCover, double lifeCoverGap, boolean taxPayer, boolean anyUnverified, CalcTrace trace) {
    }

    private final RulesRepository rules;
    private final TaxEngine taxEngine;

    public SchemeEngine(RulesRepository rules, TaxEngine taxEngine) {
        this.rules = rules;
        this.taxEngine = taxEngine;
    }

    public SchemeCalc calculate(Map<String, Object> req) {
        int age = (int) Inputs.num(req, "age");
        if (age <= 0) throw new IllegalArgumentException("Your age is needed to check scheme eligibility");
        double monthlyIncome = Inputs.num(req, "monthlyIncome");
        double annualIncome = monthlyIncome * 12;
        boolean dependents = Inputs.yes(req, "dependents");
        double lifeCover = Inputs.num(req, "lifeCover");
        int girlChildAge = (int) Inputs.num(req, "girlChildAge", -1);
        int childAge = (int) Inputs.num(req, "childAge", girlChildAge);
        boolean hasEpf = Inputs.yes(req, "hasEpf");
        boolean workplacePension = Inputs.yes(req, "workplacePension");
        int seniorParentAge = (int) Inputs.num(req, "seniorParentAge", -1);

        var t = new CalcTrace().group("Your baseline");
        t.step("Age", "entered", age + " years");
        if (annualIncome > 0) t.step("Annual income", Money.inr(monthlyIncome) + " × 12", Money.inr(annualIncome));
        t.fact("age", age);
        t.fact("annualIncome", annualIncome);

        // Income-tax payer? Atal Pension Yojana is closed to taxpayers, so ask the tax engine
        // rather than guessing from a threshold.
        boolean taxPayer = false;
        if (annualIncome > 0) {
            var cmp = taxEngine.compare(TaxInput.salary(annualIncome));
            double best = Math.min(cmp.oldRegime().totalTax(), cmp.newRegime().totalTax());
            taxPayer = best > 0;
            t.step("Income-tax payable", "min(old, new) on " + Money.inr(annualIncome), Money.inr(best));
            t.fact("tax.best", best);
        }

        // Term cover the household needs, and how much of it is missing
        double coverMultiple = rules.planning("minTermCoverMultiple");
        double lifeCoverNeeded = dependents ? annualIncome * coverMultiple : 0;
        double lifeCoverGap = Math.max(0, lifeCoverNeeded - lifeCover);
        if (dependents && annualIncome > 0) {
            t.group("Protection");
            t.step("Term cover needed", Money.inr(annualIncome) + " × " + (int) coverMultiple, Money.compact(lifeCoverNeeded));
            t.step("Cover gap", "needed − current " + Money.compact(lifeCover), Money.compact(lifeCoverGap));
            t.fact("lifeCoverGap", lifeCoverGap);
        }

        List<Match> eligible = new ArrayList<>();
        List<Match> notEligible = new ArrayList<>();
        t.group("Scheme eligibility");

        for (JsonNode s : rules.schemes()) {
            JsonNode e = s.path("eligibility");
            String id = s.path("id").asString();
            String reason = null;
            String blocked = null;

            int minAge = e.path("minAge").asInt(0);
            int maxAge = e.path("maxAge").asInt(200);
            boolean ageOk = age >= minAge && age <= maxAge;

            switch (id) {
                case "apy" -> {
                    if (!ageOk) blocked = "Open between " + minAge + " and " + maxAge;
                    else if (taxPayer) blocked = "Not open to income-tax payers";
                    else if (workplacePension) blocked = "You already have a workplace pension";
                    else reason = "No workplace pension, and you are " + age + " — inside the " + minAge + "–" + maxAge + " window";
                }
                case "ssy" -> {
                    int limit = e.path("needsGirlChildUnder").asInt(10);
                    if (girlChildAge < 0) blocked = "For a daughter under " + limit;
                    else if (girlChildAge >= limit) blocked = "Your daughter is over " + limit;
                    else reason = "A daughter aged " + girlChildAge + " can hold an account until she is 21";
                }
                case "nps-vatsalya" -> {
                    int limit = e.path("needsChildUnder").asInt(18);
                    if (childAge < 0) blocked = "For a child under " + limit;
                    else if (childAge >= limit) blocked = "Your child is over " + limit;
                    else reason = "A child aged " + childAge + " has " + (18 - childAge) + " years of compounding before the account is theirs";
                }
                case "epf-vpf" -> {
                    if (!hasEpf) blocked = "For salaried employees with an EPF account";
                    else reason = "You already contribute to EPF, so VPF needs no new account";
                }
                case "scss" -> {
                    boolean self = age >= minAge;
                    boolean parent = seniorParentAge >= minAge;
                    if (!self && !parent) blocked = "For people aged " + minAge + " and above";
                    else reason = self ? "You are " + age + " — above the " + minAge + " threshold"
                            : "Your parent is " + seniorParentAge + " — above the " + minAge + " threshold";
                }
                case "ayushman-70" -> {
                    boolean self = age >= minAge;
                    boolean parent = seniorParentAge >= e.path("orSeniorParentAge").asInt(70);
                    if (!self && !parent) blocked = "For people aged " + minAge + " and above";
                    else reason = self ? "Everyone aged " + minAge + "+ qualifies, whatever their income"
                            : "Your parent aged " + seniorParentAge + " qualifies, whatever their income";
                }
                case "pmjjby" -> {
                    if (!ageOk) blocked = "Open between " + minAge + " and " + maxAge;
                    else if (lifeCoverGap > 0) reason = "You are short " + Money.compact(lifeCoverGap) + " of term cover";
                    else reason = dependents ? "Adds " + Money.compact(s.path("benefit").asDouble()) + " on top of your existing cover"
                            : "The cheapest life cover available to you at " + age;
                }
                case "pmsby" -> {
                    if (!ageOk) blocked = "Open between " + minAge + " and " + maxAge;
                    else reason = "Accident cover no private policy matches at this price";
                }
                case "nps" -> {
                    if (!ageOk) blocked = "Open between " + minAge + " and " + maxAge;
                    else reason = "An extra " + Money.inr(deductionLimit("sec80CCD1B")) + " deduction of its own in the old regime";
                }
                default -> {
                    if (!ageOk) blocked = "Open between " + minAge + " and " + maxAge;
                    else reason = "Open to you";
                }
            }

            Match m = toMatch(s, blocked == null ? "eligible" : "not", blocked == null ? reason : blocked);
            if (blocked == null) {
                eligible.add(m);
                t.step(m.shortName(), m.reason(), m.annualCost() > 0 ? Money.inr(m.annualCost()) + "/yr" : "no fixed cost");
                if (m.annualCost() > 0) t.fact("scheme." + id + ".cost", m.annualCost());
                if (m.benefit() > 0) t.fact("scheme." + id + ".benefit", m.benefit());
            } else {
                notEligible.add(m);
            }
        }

        eligible.sort((a, b) -> Integer.compare(priority(a.id()), priority(b.id())));
        double totalCost = eligible.stream().mapToDouble(Match::annualCost).sum();
        double totalCover = eligible.stream().mapToDouble(Match::benefit).sum();
        t.group("Verdict");
        t.step("Schemes you qualify for", "matched by the rules above", String.valueOf(eligible.size()));
        if (totalCost > 0) t.step("Cost of the priced ones", "sum of annual premiums", Money.inr(totalCost) + "/yr");
        if (totalCover > 0) t.step("Cover they add", "sum of insured amounts", Money.compact(totalCover));
        t.fact("schemes.count", eligible.size());
        t.fact("schemes.totalCost", totalCost);
        t.fact("schemes.totalCover", totalCover);
        boolean anyUnverified = eligible.stream().anyMatch(m -> !m.confirmed());
        if (anyUnverified) t.assume("Scheme amounts and age limits are from the rules file and still need checking against the official page");

        return new SchemeCalc(eligible, notEligible, totalCost, totalCover, lifeCoverGap, taxPayer, anyUnverified, t);
    }

    private Match toMatch(JsonNode s, String status, String reason) {
        String deductionKey = s.path("deductionKey").asString(null);
        String section = deductionKey == null ? null : rules.tax().deduction(deductionKey).display();
        return new Match(
                s.path("id").asString(), s.path("name").asString(), s.path("short").asString(),
                s.path("category").asString(), s.path("what").asString(), status, reason,
                s.path("annualCost").asDouble(0), s.path("benefit").asDouble(0), section,
                action(s.path("id").asString()), s.path("authority").asString(), s.path("source").asString(),
                s.path("confirmed").asBoolean(false));
    }

    /** What the person actually has to do — deliberately one short step each. */
    private static String action(String id) {
        return switch (id) {
            case "pmjjby", "pmsby" -> "Ask your bank to enrol you — it is a one-page form and an auto-debit mandate";
            case "apy" -> "Open it through your bank's net banking, under Atal Pension Yojana";
            case "nps" -> "Open a Tier I account with any bank or on the NPS Trust site";
            case "nps-vatsalya" -> "Open it in the child's name at a bank that offers NPS";
            case "ssy" -> "Open the account at a post office or bank with the birth certificate";
            case "ppf" -> "Open a PPF account at a bank or post office";
            case "scss" -> "Open it at a post office or bank within a month of receiving retirement money";
            case "ayushman-70" -> "Create the Ayushman card on the PM-JAY site or at a CSC with Aadhaar";
            case "epf-vpf" -> "Ask HR to raise your VPF share — it comes out of salary like EPF";
            default -> "Check the official page for how to apply";
        };
    }

    private static int priority(String id) {
        return switch (id) {
            case "pmjjby", "pmsby", "ayushman-70" -> 1;
            case "ssy", "nps" -> 2;
            case "apy", "ppf", "scss" -> 3;
            default -> 4;
        };
    }

    private double deductionLimit(String key) {
        Double limit = rules.tax().deduction(key).limit();
        return limit == null ? 0 : limit;
    }
}
