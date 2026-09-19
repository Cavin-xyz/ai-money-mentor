package ai.money.mentor.backend.rag;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Hybrid retrieval over official sources: Qdrant vector search + SQLite FTS5 keyword search,
 * merged with reciprocal-rank fusion and filtered to rules valid for the requested tax year.
 */
@Service
public class KnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeService.class);
    private static final int CANDIDATES = 8;
    // Measured with bge-m3: relevant passages score 0.59–0.71, off-topic ≤ 0.43
    private static final double MIN_SIMILARITY = 0.52;
    private static final int RRF_K = 60;

    private final VectorStore vectorStore;
    private final KeywordIndex keywords;
    private final SectionMapper sections;
    private final JdbcClient jdbc;

    public KnowledgeService(VectorStore vectorStore, KeywordIndex keywords, SectionMapper sections, JdbcClient jdbc) {
        this.vectorStore = vectorStore;
        this.keywords = keywords;
        this.sections = sections;
        this.jdbc = jdbc;
    }

    private record Candidate(String id, String text, String title, String authority, String section, String sectionOld,
            String taxYear, String url, double similarity) {
    }

    public List<Citation> retrieve(String query, String taxYear, int k) {
        if (query == null || query.isBlank() || keywords.count() == 0) return List.of();
        String expanded = sections.expand(query);
        Map<String, Double> fused = new HashMap<>();
        Map<String, Candidate> byId = new LinkedHashMap<>();

        List<Document> vec = List.of();
        try {
            vec = vectorStore.similaritySearch(SearchRequest.builder()
                    .query(expanded)
                    .topK(CANDIDATES)
                    .similarityThreshold(MIN_SIMILARITY)
                    .filterExpression("tax_year in ['" + taxYear + "', 'all']")
                    .build());
        } catch (Exception e) {
            log.warn("Vector search unavailable, using keyword search only: {}", e.getMessage());
        }
        for (int i = 0; i < vec.size(); i++) {
            var d = vec.get(i);
            var m = d.getMetadata();
            byId.put(d.getId(), new Candidate(d.getId(), d.getText(), str(m, "title"), str(m, "authority"), str(m, "section"),
                    str(m, "section_old"), str(m, "tax_year"), str(m, "url"), d.getScore() == null ? 0 : d.getScore()));
            fused.merge(d.getId(), 1.0 / (RRF_K + i + 1), Double::sum);
        }

        var hits = keywords.search(expanded, taxYear, CANDIDATES);
        boolean exactTerm = !sections.sectionsIn(query).isEmpty();
        if (!vec.isEmpty() || exactTerm) { // keyword-only results are trusted only for exact section lookups
            for (int i = 0; i < hits.size(); i++) {
                var h = hits.get(i);
                byId.putIfAbsent(h.chunkId(), new Candidate(h.chunkId(), h.text(), h.title(), h.authority(), h.section(),
                        h.sectionOld(), h.taxYear(), h.url(), 0));
                fused.merge(h.chunkId(), 1.0 / (RRF_K + i + 1), Double::sum);
            }
        }

        List<Citation> out = new ArrayList<>();
        fused.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(k)
                .forEach(e -> {
                    var c = byId.get(e.getKey());
                    out.add(new Citation("S" + (out.size() + 1), c.authority(), c.title(), c.section(), c.sectionOld(),
                            c.taxYear(), c.url(), snippet(c.text()), Math.round(e.getValue() * 10000) / 10000.0));
                });
        return out;
    }

    /** Documents grouped by authority — for the "Trusted sources" panel. */
    public List<Map<String, Object>> sources() {
        var rows = jdbc.sql("SELECT authority, title, url, tax_year, verified_on, chunks, ingested_at FROM ingested_doc ORDER BY authority, title")
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("authority", rs.getString("authority"));
                    m.put("title", rs.getString("title"));
                    m.put("url", rs.getString("url"));
                    m.put("taxYear", rs.getString("tax_year"));
                    m.put("verifiedOn", rs.getString("verified_on"));
                    m.put("chunks", rs.getInt("chunks"));
                    return m;
                }).list();
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        for (var r : rows) {
            var g = groups.computeIfAbsent(String.valueOf(r.get("authority")), a -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("authority", a);
                x.put("documents", new ArrayList<Map<String, Object>>());
                x.put("chunks", 0);
                x.put("verifiedOn", "");
                return x;
            });
            @SuppressWarnings("unchecked")
            var docs = (List<Map<String, Object>>) g.get("documents");
            docs.add(r);
            g.put("chunks", (int) g.get("chunks") + (int) r.get("chunks"));
            String v = String.valueOf(r.getOrDefault("verifiedOn", ""));
            if (v.compareTo(String.valueOf(g.get("verifiedOn"))) > 0) g.put("verifiedOn", v);
        }
        return groups.values().stream().sorted(Comparator.comparing(g -> -(int) g.get("chunks"))).toList();
    }

    public int chunkCount() {
        return keywords.count();
    }

    public int documentCount() {
        return jdbc.sql("SELECT COUNT(*) FROM ingested_doc").query(Integer.class).single();
    }

    private static String snippet(String text) {
        if (text == null) return "";
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() <= 700 ? t : t.substring(0, 700) + "…";
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null || "null".equals(v.toString()) ? null : v.toString();
    }
}
