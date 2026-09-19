package ai.money.mentor.backend.rules;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Versioned tax rules for one tax year, loaded from {@code rules/tax-<year>.json}. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TaxRules(
        String taxYear,
        String label,
        String act,
        String incomePeriod,
        String verifiedOn,
        String verificationStatus,
        Regime newRegime,
        Regime oldRegime,
        double cessPct,
        int roundTaxToNearest,
        Map<String, Deduction> deductions,
        List<Source> sources) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Regime(String name, String section, String formerSection, double standardDeduction,
            List<Slab> slabs, Rebate rebate, List<Surcharge> surcharge, double employerNpsPctOfBasic,
            List<String> allowedDeductions, String source) {

        public String display() {
            if (section == null) return name;
            return formerSection == null ? name + " (Sec " + section + ")"
                    : name + " (Sec " + section + ", formerly " + formerSection + ")";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Slab(Double upTo, double ratePct) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Rebate(String section, String formerSection, double maxRebate, double incomeLimit,
            boolean marginalRelief) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Surcharge(double above, double ratePct) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Deduction(String label, String section, String formerSection, Double limit, Double seniorLimit) {

        /** "Sec 123 (formerly 80C)" / "Sec 80C" / "80D" when the new number is unconfirmed. */
        public String display() {
            if (section == null) return "Sec " + formerSection;
            if (formerSection == null) return "Sec " + section;
            return "Sec " + section + " (formerly " + formerSection + ")";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Source(String authority, String title, String url) {
    }

    public Deduction deduction(String key) {
        return deductions.get(key);
    }

    public String primarySourceUrl() {
        return sources == null || sources.isEmpty() ? null : sources.get(0).url();
    }
}
