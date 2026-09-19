package ai.money.mentor.backend.rules;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Numeric rules live in versioned JSON, never in the vector store: a tax threshold must
 * never be "retrieved approximately". Every value carries a source and verification date.
 */
@Component
public class RulesRepository {

    public static final List<String> SUPPORTED_TAX_YEARS = List.of("2026-27", "2025-26");

    private final Map<String, TaxRules> taxRules = new LinkedHashMap<>();
    private final JsonNode limits;
    private final JsonNode schemes;
    private final List<SectionMapping> sectionMap = new ArrayList<>();
    private final String defaultTaxYear;

    public RulesRepository(JsonMapper jsonMapper, @Value("${mentor.default-tax-year}") String defaultTaxYear)
            throws IOException {
        this.defaultTaxYear = defaultTaxYear;
        for (String year : SUPPORTED_TAX_YEARS) {
            try (InputStream in = new ClassPathResource("rules/tax-" + year + ".json").getInputStream()) {
                taxRules.put(year, jsonMapper.readValue(in, TaxRules.class));
            }
        }
        try (InputStream in = new ClassPathResource("rules/limits.json").getInputStream()) {
            this.limits = jsonMapper.readTree(in);
        }
        try (InputStream in = new ClassPathResource("rules/schemes.json").getInputStream()) {
            this.schemes = jsonMapper.readTree(in);
        }
        try (InputStream in = new ClassPathResource("rules/section-map.json").getInputStream()) {
            for (JsonNode m : jsonMapper.readTree(in).path("mappings")) {
                sectionMap.add(new SectionMapping(m.path("old").asString(), m.path("new").asString(),
                        m.path("topic").asString(), m.path("confirmed").asBoolean()));
            }
        }
    }

    public TaxRules tax(String taxYear) {
        TaxRules r = taxRules.get(taxYear == null || taxYear.isBlank() ? defaultTaxYear : taxYear);
        if (r == null) throw new IllegalArgumentException("Unsupported tax year: " + taxYear);
        return r;
    }

    public TaxRules tax() {
        return tax(defaultTaxYear);
    }

    public String defaultTaxYear() {
        return defaultTaxYear;
    }

    public List<SectionMapping> sectionMap() {
        return sectionMap;
    }

    /** Long-run planning assumption, e.g. "inflationPct" → 6. */
    public double assumption(String key) {
        return limits.path("assumptions").path(key).path("value").asDouble();
    }

    public String assumptionNote(String key) {
        return limits.path("assumptions").path(key).path("note").asString("");
    }

    public double planning(String key) {
        return limits.path("planning").path(key).asDouble();
    }

    public JsonNode planningNode(String key) {
        return limits.path("planning").path(key);
    }

    public double rule(String key) {
        return limits.path("rules").path(key).path("value").asDouble();
    }

    public JsonNode ruleNode(String key) {
        return limits.path("rules").path(key);
    }

    public String ruleSource(String key) {
        JsonNode n = limits.path("rules").path(key);
        return n.path("authority").asString("") + " · " + n.path("source").asString("");
    }

    /** A top-level block of limits.json, e.g. "scam". */
    public JsonNode block(String key) {
        return limits.path(key);
    }

    public JsonNode portfolioNode(String key) {
        return limits.path("portfolio").path(key);
    }

    /** Government schemes with their eligibility rules, from rules/schemes.json. */
    public JsonNode schemes() {
        return schemes.path("schemes");
    }

    public String schemesVerifiedOn() {
        return schemes.path("verifiedOn").asString("");
    }

    public String limitsVerifiedOn() {
        return limits.path("verifiedOn").asString();
    }

    public record SectionMapping(String oldSection, String newSection, String topic, boolean confirmed) {
    }
}
