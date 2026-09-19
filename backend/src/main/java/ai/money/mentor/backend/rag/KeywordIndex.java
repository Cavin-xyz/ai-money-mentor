package ai.money.mentor.backend.rag;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Keyword half of hybrid retrieval: SQLite FTS5 with BM25 ranking. Embeddings are weak on
 * exact tokens like "80C" or "24(b)"; keyword search is strong on them.
 */
@Component
public class KeywordIndex {

    private static final Set<String> STOP = Set.of("the", "a", "an", "is", "are", "can", "i", "my", "me", "of", "in", "on",
            "for", "to", "and", "or", "what", "how", "do", "does", "under", "with", "it", "be", "this", "that", "should", "which");

    public record Hit(String chunkId, String text, String title, String authority, String section, String sectionOld,
            String taxYear, String url, double rank) {
    }

    private final JdbcClient jdbc;

    public KeywordIndex(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void add(String chunkId, String text, String title, String authority, String section, String sectionOld,
            String taxYear, String url, String docHash) {
        jdbc.sql("INSERT INTO chunk_fts(chunk_id, text, title, authority, section, section_old, tax_year, url, doc_hash) VALUES (?,?,?,?,?,?,?,?,?)")
                .params(chunkId, text, title, authority, section, sectionOld, taxYear, url, docHash)
                .update();
    }

    public void deleteDoc(String docHash) {
        jdbc.sql("DELETE FROM chunk_fts WHERE doc_hash = ?").param(docHash).update();
    }

    public List<String> chunkIds(String docHash) {
        return jdbc.sql("SELECT chunk_id FROM chunk_fts WHERE doc_hash = ?").param(docHash).query(String.class).list();
    }

    public int count() {
        return jdbc.sql("SELECT COUNT(*) FROM chunk_fts").query(Integer.class).single();
    }

    public List<Hit> search(String query, String taxYear, int limit) {
        String match = toMatch(query);
        if (match.isBlank()) return List.of();
        return jdbc.sql("""
                SELECT chunk_id, text, title, authority, section, section_old, tax_year, url, bm25(chunk_fts) AS rank
                FROM chunk_fts
                WHERE chunk_fts MATCH ? AND (tax_year = ? OR tax_year = 'all')
                ORDER BY rank LIMIT ?""")
                .params(match, taxYear, limit)
                .query((rs, n) -> new Hit(rs.getString("chunk_id"), rs.getString("text"), rs.getString("title"),
                        rs.getString("authority"), rs.getString("section"), rs.getString("section_old"),
                        rs.getString("tax_year"), rs.getString("url"), rs.getDouble("rank")))
                .list();
    }

    public Hit byId(String chunkId) {
        return jdbc.sql("SELECT chunk_id, text, title, authority, section, section_old, tax_year, url, 0 AS rank FROM chunk_fts WHERE chunk_id = ?")
                .param(chunkId)
                .query((rs, n) -> new Hit(rs.getString("chunk_id"), rs.getString("text"), rs.getString("title"),
                        rs.getString("authority"), rs.getString("section"), rs.getString("section_old"),
                        rs.getString("tax_year"), rs.getString("url"), 0))
                .optional().orElse(null);
    }

    /** Turns free text into a safe FTS5 query: quoted terms OR-ed together (no user syntax reaches FTS5). */
    static String toMatch(String query) {
        Set<String> terms = new LinkedHashSet<>();
        for (String raw : query.toLowerCase(Locale.ROOT).split("[^a-z0-9()]+")) {
            String t = raw.replaceAll("[()]", "");
            if (t.length() < 2 || STOP.contains(t)) continue;
            terms.add("\"" + t + "\"");
            if (terms.size() >= 16) break;
        }
        return String.join(" OR ", new ArrayList<>(terms));
    }
}
