package ai.money.mentor.backend.rag;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.Yaml;

import ai.money.mentor.backend.documents.PdfText;

/**
 * Document Processing: manifest → text extraction (PDF/HTML/Markdown) → section-aware chunking →
 * embeddings (bge-m3 on CPU) → Qdrant, plus the FTS5 keyword index. Unchanged documents are
 * skipped by content hash, so re-running ingestion is cheap.
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);
    private static final int BATCH = 16;

    private final VectorStore vectorStore;
    private final KeywordIndex keywords;
    private final SectionMapper sections;
    private final JdbcClient jdbc;
    private final Path knowledgeDir;
    private final AtomicReference<Map<String, Object>> status = new AtomicReference<>(Map.of("state", "idle"));

    public IngestionService(VectorStore vectorStore, KeywordIndex keywords, SectionMapper sections, JdbcClient jdbc,
            @Value("${mentor.knowledge-dir}") String knowledgeDir) {
        this.vectorStore = vectorStore;
        this.keywords = keywords;
        this.sections = sections;
        this.jdbc = jdbc;
        this.knowledgeDir = Path.of(knowledgeDir);
    }

    public Map<String, Object> status() {
        return status.get();
    }

    public boolean running() {
        return "running".equals(status.get().get("state"));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> ingestAll() {
        Path manifest = knowledgeDir.resolve("manifest.yaml");
        if (!Files.exists(manifest)) throw new IllegalArgumentException("No manifest at " + manifest.toAbsolutePath());
        List<Map<String, Object>> docs;
        try (InputStream in = Files.newInputStream(manifest)) {
            Map<String, Object> root = new Yaml().load(in);
            docs = (List<Map<String, Object>>) root.getOrDefault("documents", List.of());
        } catch (IOException e) {
            throw new IllegalArgumentException("Cannot read manifest: " + e.getMessage());
        }
        int added = 0, skipped = 0, chunks = 0;
        List<String> errors = new ArrayList<>();
        long start = System.currentTimeMillis();
        for (int i = 0; i < docs.size(); i++) {
            var d = docs.get(i);
            String name = String.valueOf(d.getOrDefault("title", d.get("file")));
            status.set(Map.of("state", "running", "current", name, "done", i, "total", docs.size(), "chunks", chunks));
            try {
                int n = ingest(d);
                if (n < 0) skipped++;
                else {
                    added++;
                    chunks += n;
                }
            } catch (Exception e) {
                log.warn("Ingestion failed for {}: {}", name, e.getMessage());
                errors.add(name + ": " + e.getMessage());
            }
        }
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("state", "done");
        report.put("documents", docs.size());
        report.put("ingested", added);
        report.put("unchanged", skipped);
        report.put("chunksAdded", chunks);
        report.put("totalChunks", keywords.count());
        report.put("seconds", (System.currentTimeMillis() - start) / 1000);
        report.put("errors", errors);
        status.set(report);
        return report;
    }

    /** @return chunks added, or -1 if the document is unchanged since the last run */
    private int ingest(Map<String, Object> d) throws Exception {
        String title = req(d, "title");
        String authority = req(d, "authority");
        String url = String.valueOf(d.getOrDefault("url", ""));
        String taxYear = String.valueOf(d.getOrDefault("taxYear", "all"));
        String verifiedOn = String.valueOf(d.getOrDefault("verifiedOn", ""));
        String file = (String) d.get("file");

        byte[] bytes = load(file, url);
        String hash = sha256(bytes, title + authority + taxYear + url);
        boolean known = jdbc.sql("SELECT COUNT(*) FROM ingested_doc WHERE hash = ?").param(hash).query(Integer.class).single() > 0;
        if (known) return -1;

        // A changed version of the same source replaces the old chunks
        String source = file != null ? file : url;
        for (String oldHash : jdbc.sql("SELECT hash FROM ingested_doc WHERE source = ?").param(source).query(String.class).list()) {
            List<String> ids = keywords.chunkIds(oldHash);
            if (!ids.isEmpty()) vectorStore.delete(ids);
            keywords.deleteDoc(oldHash);
            jdbc.sql("DELETE FROM ingested_doc WHERE hash = ?").param(oldHash).update();
        }

        String text = extract(bytes, file != null ? file : url);
        var parts = SectionSplitter.split(text);
        List<Document> batch = new ArrayList<>();
        int count = 0;
        for (var p : parts) {
            List<String> refs = sections.sectionsIn(p.heading() + " " + p.text());
            String[] pair = sections.pair(refs.isEmpty() ? null : refs.get(0));
            String label = "[" + title + " · " + authority
                    + (pair[0] != null ? " · Sec " + pair[0] + (pair[1] != null ? " (formerly " + pair[1] + ")" : "") : "")
                    + (taxYear.equals("all") ? "" : " · TY " + taxYear) + "]";
            String chunkText = label + "\n" + (p.heading().isBlank() ? "" : p.heading() + "\n") + p.text();
            String id = UUID.randomUUID().toString();
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("title", title);
            meta.put("authority", authority);
            meta.put("url", url);
            meta.put("tax_year", taxYear);
            meta.put("doc_hash", hash);
            if (pair[0] != null) meta.put("section", pair[0]);
            if (pair[1] != null) meta.put("section_old", pair[1]);
            batch.add(new Document(id, chunkText, meta));
            keywords.add(id, chunkText, title, authority, pair[0], pair[1], taxYear, url, hash);
            count++;
            if (batch.size() >= BATCH) {
                vectorStore.add(batch);
                batch = new ArrayList<>();
            }
        }
        if (!batch.isEmpty()) vectorStore.add(batch);
        jdbc.sql("INSERT INTO ingested_doc(hash, source, title, authority, tax_year, url, verified_on, chunks, ingested_at) VALUES (?,?,?,?,?,?,?,?,?)")
                .params(hash, source, title, authority, taxYear, url, verifiedOn, count, Instant.now().toString())
                .update();
        log.info("Ingested '{}' ({} chunks)", title, count);
        return count;
    }

    private byte[] load(String file, String url) throws IOException, InterruptedException {
        if (file != null && !file.isBlank()) {
            Path p = knowledgeDir.resolve(file).normalize();
            if (!p.startsWith(knowledgeDir.normalize())) throw new IllegalArgumentException("File outside knowledge dir");
            return Files.readAllBytes(p);
        }
        if (url == null || url.isBlank()) throw new IllegalArgumentException("Document needs a file or url");
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NORMAL).build();
        var resp = client.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(60))
                .header("User-Agent", "MoneyMentor-ingest/1.0").build(), HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() != 200) throw new IOException("HTTP " + resp.statusCode());
        return resp.body();
    }

    static String extract(byte[] bytes, String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".pdf") || (bytes.length > 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F')) {
            return PdfText.extract(bytes, null);
        }
        String s = new String(bytes, StandardCharsets.UTF_8);
        if (n.endsWith(".html") || n.endsWith(".htm") || s.stripLeading().startsWith("<")) {
            var doc = Jsoup.parse(s);
            doc.select("script, style, nav, header, footer, noscript, form, iframe").remove();
            Element root = doc.selectFirst("main, article, #content, .content");
            if (root == null) root = doc.body();
            StringBuilder out = new StringBuilder();
            for (Element e : root.select("h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote")) {
                String t = e.ownText().isBlank() ? e.text() : e.text();
                if (t.isBlank()) continue;
                if (e.tagName().matches("h[1-4]")) out.append("\n## ").append(t).append('\n');
                else out.append(t).append('\n');
            }
            return out.toString();
        }
        return s;
    }

    private static String req(Map<String, Object> d, String k) {
        Object v = d.get(k);
        if (v == null || v.toString().isBlank()) throw new IllegalArgumentException("manifest entry missing '" + k + "'");
        return v.toString();
    }

    private static String sha256(byte[] bytes, String salt) throws Exception {
        var md = MessageDigest.getInstance("SHA-256");
        md.update(bytes);
        md.update(salt.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(md.digest());
    }
}
