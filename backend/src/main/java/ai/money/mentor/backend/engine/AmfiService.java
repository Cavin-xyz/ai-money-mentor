package ai.money.mentor.backend.engine;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * AMFI's public daily NAV file (every scheme's code, category, plan, NAV and date), cached in
 * data/amfi so the X-Ray works offline. Refreshed when online and older than a day.
 */
@Service
public class AmfiService {

    private static final Logger log = LoggerFactory.getLogger(AmfiService.class);
    public static final String SOURCE_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

    public record Scheme(String code, String name, String plan, String option, double nav, String navDate,
            String amc, String amfiCategory, String category, String assetClass, boolean direct) {
    }

    private final Path file;
    private volatile List<Scheme> schemes = List.of();
    private volatile String navDate = "";

    public AmfiService(@Value("${mentor.data-dir}") String dataDir) {
        this.file = Path.of(dataDir, "amfi", "NAVAll.txt");
        refreshIfStale();
        load();
    }

    public List<Scheme> all() {
        return schemes;
    }

    public String navDate() {
        return navDate;
    }

    public boolean loaded() {
        return !schemes.isEmpty();
    }

    /** Autocomplete: growth-option schemes ranked by token overlap with the query. */
    public List<Scheme> search(String query, int limit) {
        if (query == null || query.isBlank()) return List.of();
        Set<String> q = tokens(query);
        return schemes.stream()
                .filter(s -> s.option() == null || s.option().toLowerCase(Locale.ROOT).contains("growth"))
                .map(s -> new Object[] { s, similarity(q, tokens(s.name() + " " + s.plan())) })
                .filter(o -> (double) o[1] > 0.2)
                .sorted(Comparator.comparingDouble((Object[] o) -> (double) o[1]).reversed())
                .limit(limit)
                .map(o -> (Scheme) o[0])
                .toList();
    }

    /** Best match for a holding name typed by the user or read from a statement. */
    public Scheme match(String name, String amfiCode) {
        if (amfiCode != null && !amfiCode.isBlank()) {
            for (Scheme s : schemes) if (s.code().equals(amfiCode.trim())) return s;
        }
        List<Scheme> hits = search(name, 1);
        return hits.isEmpty() ? null : hits.get(0);
    }

    // ── loading ──────────────────────────────────────────────────────

    private void refreshIfStale() {
        try {
            if (Files.exists(file) && Duration.between(Files.getLastModifiedTime(file).toInstant(), Instant.now()).toHours() < 24) return;
            Files.createDirectories(file.getParent());
            var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NORMAL).build();
            var resp = client.send(HttpRequest.newBuilder(URI.create(SOURCE_URL)).timeout(Duration.ofSeconds(30)).build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() == 200 && resp.body().contains("Scheme Code")) {
                Files.writeString(file, resp.body(), StandardCharsets.UTF_8);
                log.info("Refreshed AMFI NAV file");
            }
        } catch (Exception e) {
            log.info("AMFI refresh skipped (offline?) — using cached file: {}", e.getMessage());
        }
    }

    private void load() {
        if (!Files.exists(file)) {
            log.warn("AMFI NAV file missing at {} — portfolio matching disabled", file);
            return;
        }
        List<Scheme> out = new ArrayList<>();
        String amfiCategory = "", amc = "";
        java.util.Map<String, Integer> dateCounts = new java.util.HashMap<>();
        try {
            for (String raw : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                String line = raw.strip();
                if (line.isEmpty() || line.startsWith("Scheme Code")) continue;
                if (!line.contains(";")) {
                    if (line.contains("Schemes(") || line.contains("Scheme(")) amfiCategory = line.substring(line.indexOf('(') + 1, line.lastIndexOf(')') > 0 ? line.lastIndexOf(')') : line.length());
                    else amc = line;
                    continue;
                }
                String[] p = line.split(";", -1);
                if (p.length < 8) continue;
                double nav;
                try {
                    nav = Double.parseDouble(p[6]);
                } catch (NumberFormatException e) {
                    continue;
                }
                String cat = normalise(amfiCategory, p[3]);
                boolean direct = p[4].toLowerCase(Locale.ROOT).contains("direct") || p[3].toLowerCase(Locale.ROOT).contains("direct");
                out.add(new Scheme(p[0], p[3], p[4], p[5], nav, p[7], amc, amfiCategory, cat, assetClass(cat), direct));
                dateCounts.merge(p[7].trim(), 1, Integer::sum);
            }
        } catch (IOException e) {
            log.warn("Could not read AMFI file: {}", e.getMessage());
        }
        this.schemes = List.copyOf(out);
        // The most common date is the file's NAV date (a few schemes carry stale or odd dates)
        this.navDate = dateCounts.entrySet().stream().max(java.util.Map.Entry.comparingByValue())
                .map(java.util.Map.Entry::getKey).orElse("");
        log.info("Loaded {} AMFI schemes (NAV date {})", out.size(), navDate);
    }

    static String normalise(String amfiCategory, String name) {
        String c = (amfiCategory + " " + name).toLowerCase(Locale.ROOT);
        if (c.contains("index") || c.contains("equity etf") || c.contains("nifty") && c.contains("etf")) return "Index";
        if (c.contains("overseas") || c.contains("international") || c.contains("global") || c.contains("nasdaq") || c.contains("us equity")) return "International";
        if (c.contains("gold") || c.contains("silver")) return "Gold/Silver";
        if (c.contains("large & mid")) return "Large & Mid Cap";
        if (c.contains("large cap")) return "Large Cap";
        if (c.contains("mid cap")) return "Mid Cap";
        if (c.contains("small cap")) return "Small Cap";
        if (c.contains("flexi cap")) return "Flexi Cap";
        if (c.contains("multi cap")) return "Multi Cap";
        if (c.contains("elss")) return "ELSS";
        if (c.contains("focused")) return "Focused";
        if (c.contains("value") || c.contains("contra") || c.contains("dividend yield")) return "Value/Contra";
        if (c.contains("sectoral") || c.contains("thematic")) return "Sectoral/Thematic";
        if (c.contains("arbitrage")) return "Arbitrage";
        if (c.contains("hybrid") || c.contains("balanced") || c.contains("asset allocation") || c.contains("children") || c.contains("retirement")) return "Hybrid";
        if (c.contains("liquid") || c.contains("overnight") || c.contains("money market")) return "Liquid";
        if (c.contains("debt") || c.contains("gilt") || c.contains("income") || c.contains("bond")) return "Debt";
        if (c.contains("equity") || c.contains("growth")) return "Flexi Cap";
        return "Other";
    }

    static String assetClass(String category) {
        return switch (category) {
            case "Debt", "Liquid", "Arbitrage" -> "Debt";
            case "Hybrid" -> "Hybrid";
            case "Gold/Silver" -> "Gold";
            case "International" -> "International";
            case "Other" -> "Other";
            default -> "Equity";
        };
    }

    private static Set<String> tokens(String s) {
        Set<String> out = new HashSet<>();
        for (String t : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9& ]", " ").split("\\s+")) {
            if (t.length() > 1 && !Set.of("fund", "plan", "option", "the", "of", "growth", "scheme").contains(t)) out.add(t);
        }
        return out;
    }

    private static double similarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        long common = a.stream().filter(b::contains).count();
        return (double) common / a.size() * 0.8 + (double) common / b.size() * 0.2;
    }
}
