package ai.money.mentor.backend.safety;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.AmfiService;
import ai.money.mentor.backend.rag.Citation;
import ai.money.mentor.backend.rules.RulesRepository;
import ai.money.mentor.backend.rules.TaxRules;
import ai.money.mentor.backend.safety.TrustReport.Check;

/**
 * Validates model text before anyone sees it:
 * source check (citations exist), calculation check (every ₹ figure came from the engine),
 * output check (schema), product check (no named fund houses) and consistency check
 * (the text agrees with the engine's regime verdict).
 */
@Component
public class SafetyLayer {

    private static final Pattern CITE = Pattern.compile("\\[S(\\d+)]");
    private static final Pattern SENTENCE = Pattern.compile("[^.!?\\n]+[.!?]?");
    private static final double TOLERANCE = 0.02;

    private final RulesRepository rules;
    private final Set<String> amcBrands;

    public SafetyLayer(RulesRepository rules, AmfiService amfi) {
        this.rules = rules;
        Set<String> brands = new LinkedHashSet<>();
        amfi.all().forEach(s -> {
            String amc = s.amc() == null ? "" : s.amc().replaceAll("(?i)\\s*mutual fund.*$", "").trim();
            if (amc.length() >= 3) brands.add(amc.toLowerCase(Locale.ROOT));
        });
        this.amcBrands = brands;
    }

    public record Verdict(List<Check> checks, List<String> unverified, List<String> warnings, List<String> cleanedTexts) {

        public boolean numbersOk() {
            return unverified.isEmpty();
        }

        public boolean acceptable() {
            return checks.stream().allMatch(Check::passed);
        }
    }

    public Verdict check(List<String> texts, CalcTrace trace, Map<String, Object> request, List<Citation> citations,
            String regimeWinner, Set<String> allowedProducts, String taxYear) {
        List<Check> checks = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> cleaned = new ArrayList<>();

        // 1. Source check — strip citations that point at nothing
        int invalid = 0, cited = 0;
        for (String t : texts) {
            if (t == null) {
                cleaned.add(null);
                continue;
            }
            StringBuilder out = new StringBuilder();
            Matcher m = CITE.matcher(t);
            while (m.find()) {
                int n = Integer.parseInt(m.group(1));
                if (n < 1 || n > citations.size()) {
                    invalid++;
                    m.appendReplacement(out, "");
                } else {
                    cited++;
                    m.appendReplacement(out, Matcher.quoteReplacement(m.group()));
                }
            }
            m.appendTail(out);
            cleaned.add(out.toString().replaceAll(" {2,}", " ").trim());
        }
        String srcDetail = citations.isEmpty() ? "No sources retrieved; answer avoids legal claims"
                : cited + " citation(s) to " + citations.size() + " retrieved source(s)" + (invalid > 0 ? "; removed " + invalid + " invalid" : "");
        checks.add(new Check("source", "Sources", invalid == 0, srcDetail));
        if (invalid > 0) warnings.add("Removed " + invalid + " citation(s) that did not match a retrieved source");

        // 2. Calculation check — every ₹ figure must come from the engine, a rule or the user's input
        List<Double> allowed = allowedAmounts(trace, request, taxYear);
        // Figures quoted from a retrieved official passage are grounded too
        for (var c : citations) allowed.addAll(Money.amountsIn(c.snippet()));
        List<String> unverified = new ArrayList<>();
        int amounts = 0;
        for (String t : cleaned) {
            for (double a : Money.amountsIn(t)) {
                amounts++;
                if (!matches(a, allowed)) unverified.add(Money.inr(a));
            }
        }
        checks.add(new Check("numbers", "Numbers match calculator", unverified.isEmpty(),
                unverified.isEmpty() ? amounts + " ₹ figure(s) verified against the engine" : "Not from calculator: " + String.join(", ", unverified)));

        // 3. Product check — no named fund houses unless the user already holds them
        List<String> products = new ArrayList<>();
        for (String t : cleaned) {
            if (t == null) continue;
            String low = t.toLowerCase(Locale.ROOT);
            for (String b : amcBrands) {
                int i = low.indexOf(b);
                if (i < 0) continue;
                String around = low.substring(i, Math.min(low.length(), i + b.length() + 40));
                boolean fundContext = around.contains("fund") || around.contains("scheme") || around.contains("plan");
                boolean owned = allowedProducts.stream().anyMatch(p -> p.toLowerCase(Locale.ROOT).contains(b));
                if (fundContext && !owned && !isCommonWord(b)) products.add(b);
            }
        }
        checks.add(new Check("products", "Category-level only", products.isEmpty(),
                products.isEmpty() ? "No named schemes or fund houses recommended" : "Named fund house(s): " + String.join(", ", products)));

        // 4. Consistency check — the regime the text favours must match the engine
        boolean consistent = true;
        if (regimeWinner != null && !"equal".equals(regimeWinner)) {
            String loser = "new".equals(regimeWinner) ? "old" : "new";
            for (String t : cleaned) {
                if (t == null) continue;
                Matcher s = SENTENCE.matcher(t.toLowerCase(Locale.ROOT));
                while (s.find()) {
                    String sent = s.group();
                    if (sent.contains(loser + " regime") && !sent.contains(regimeWinner + " regime")
                            && sent.matches(".*\\b(better|cheaper|lower tax|saves? more|recommend\\w*|should (choose|pick|opt)|go with)\\b.*")
                            && !sent.matches(".*\\b(not|isn't|doesn't|won't|only if|unless)\\b.*")) {
                        consistent = false;
                    }
                }
            }
        }
        checks.add(new Check("consistency", "Consistent with calculator", consistent,
                consistent ? (regimeWinner == null ? "No regime claim to check" : "Agrees that the " + regimeWinner + " regime is better")
                        : "Text favours the regime the calculator rejected"));

        return new Verdict(checks, unverified, warnings, cleaned);
    }

    public TrustReport report(Verdict v, boolean outputOk, String explanationSource, List<String> extraWarnings) {
        List<Check> checks = new ArrayList<>(v.checks());
        checks.add(2, new Check("output", "Output validated", outputOk, outputOk ? "Response matched the expected structure" : "Model output was malformed; template used"));
        int score = 0;
        for (var c : checks) {
            if (!c.passed()) continue;
            score += switch (c.key()) {
                case "numbers" -> 40;
                case "source" -> 25;
                case "output" -> 15;
                case "products", "consistency" -> 10;
                default -> 0;
            };
        }
        List<String> warnings = new ArrayList<>(v.warnings());
        warnings.addAll(extraWarnings);
        return new TrustReport(checks, warnings, score, explanationSource, TrustReport.DISCLAIMER);
    }

    /** Feedback for the single retry: the model is told exactly which figures it may use. */
    public String retryFeedback(Verdict v, CalcTrace trace) {
        StringBuilder s = new StringBuilder("Your previous answer failed validation.");
        if (!v.unverified().isEmpty()) s.append(" These figures are NOT in CALCULATIONS: ").append(String.join(", ", v.unverified())).append('.');
        v.checks().stream().filter(c -> !c.passed() && !"numbers".equals(c.key())).forEach(c -> s.append(' ').append(c.detail()).append('.'));
        s.append(" Rewrite using only figures copied from CALCULATIONS, or no figures at all.");
        return s.toString();
    }

    private List<Double> allowedAmounts(CalcTrace trace, Map<String, Object> request, String taxYear) {
        List<Double> out = new ArrayList<>();
        trace.facts().values().forEach(v -> addWithDerivatives(out, v));
        collect(request, out);
        TaxRules r = rules.tax(taxYear);
        for (var reg : List.of(r.newRegime(), r.oldRegime())) {
            out.add(reg.standardDeduction());
            out.add(reg.rebate().maxRebate());
            out.add(reg.rebate().incomeLimit());
            reg.slabs().forEach(sl -> { if (sl.upTo() != null) out.add(sl.upTo()); });
            reg.surcharge().forEach(sc -> out.add(sc.above()));
        }
        r.deductions().values().forEach(d -> {
            if (d.limit() != null) out.add(d.limit());
            if (d.seniorLimit() != null) out.add(d.seniorLimit());
        });
        out.add(0.0);
        return out;
    }

    private static void addWithDerivatives(List<Double> out, double v) {
        out.add(v);
        out.add(v * 12);
        out.add(v / 12);
    }

    @SuppressWarnings("unchecked")
    private static void collect(Object node, List<Double> out) {
        if (node instanceof Map<?, ?> m) m.values().forEach(v -> collect(v, out));
        else if (node instanceof List<?> l) l.forEach(v -> collect(v, out));
        else if (node != null) {
            double d = Money.parse(node);
            if (d > 0) addWithDerivatives(out, d);
        }
    }

    private static boolean matches(double a, List<Double> allowed) {
        for (double v : allowed) {
            double tol = Math.max(Math.abs(v) * TOLERANCE, 100);
            if (Math.abs(a - v) <= tol) return true;
        }
        return false;
    }

    private static boolean isCommonWord(String brand) {
        return Set.of("union", "trust", "quantum", "unifi", "old bridge", "navi", "the").contains(brand);
    }
}
