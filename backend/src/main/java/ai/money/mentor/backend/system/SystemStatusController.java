package ai.money.mentor.backend.system;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import ai.money.mentor.backend.engine.AmfiService;
import ai.money.mentor.backend.memory.MemoryService;
import ai.money.mentor.backend.rag.KnowledgeService;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Health of every local component — drives the navbar status pill and the "How it works" section. */
@RestController
public class SystemStatusController {

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final JsonMapper json;
    private final KnowledgeService knowledge;
    private final MemoryService memory;
    private final RulesRepository rules;
    private final AmfiService amfi;
    private final ai.money.mentor.backend.auth.AuthService auth;
    private final String ollamaUrl;
    private final String chatModel;
    private final String embeddingModel;
    private final String qdrantCollection;

    public SystemStatusController(JsonMapper json, KnowledgeService knowledge, MemoryService memory, RulesRepository rules,
            AmfiService amfi, ai.money.mentor.backend.auth.AuthService auth, @Value("${spring.ai.ollama.base-url}") String ollamaUrl,
            @Value("${spring.ai.ollama.chat.model}") String chatModel,
            @Value("${spring.ai.ollama.embedding.model}") String embeddingModel,
            @Value("${spring.ai.vectorstore.qdrant.collection-name}") String qdrantCollection) {
        this.json = json;
        this.knowledge = knowledge;
        this.memory = memory;
        this.rules = rules;
        this.amfi = amfi;
        this.auth = auth;
        this.ollamaUrl = ollamaUrl;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.qdrantCollection = qdrantCollection;
    }

    @GetMapping("/api/system/status")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Object> ollama = new LinkedHashMap<>();
        JsonNode version = get(ollamaUrl + "/api/version");
        ollama.put("up", version != null);
        ollama.put("version", version == null ? null : version.path("version").asString(null));
        List<String> installed = new ArrayList<>();
        JsonNode tags = get(ollamaUrl + "/api/tags");
        if (tags != null) tags.path("models").forEach(m -> installed.add(m.path("name").asString()));
        List<Map<String, Object>> loaded = new ArrayList<>();
        JsonNode ps = get(ollamaUrl + "/api/ps");
        if (ps != null) ps.path("models").forEach(m -> {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("name", m.path("name").asString());
            long vram = m.path("size_vram").asLong(), size = m.path("size").asLong();
            x.put("gpuPct", size > 0 ? Math.round(vram * 100.0 / size) : 0);
            loaded.add(x);
        });
        ollama.put("chatModel", chatModel);
        ollama.put("chatInstalled", installed.stream().anyMatch(n -> n.startsWith(chatModel)));
        ollama.put("chatLoaded", loaded.stream().anyMatch(m -> m.get("name").toString().startsWith(chatModel)));
        ollama.put("embeddingModel", embeddingModel);
        ollama.put("embeddingInstalled", installed.stream().anyMatch(n -> n.startsWith(embeddingModel)));
        ollama.put("loaded", loaded);
        out.put("ollama", ollama);

        JsonNode q = get("http://localhost:6333/collections/" + qdrantCollection);
        out.put("qdrant", Map.of("up", q != null, "vectors", q == null ? 0 : q.path("result").path("points_count").asLong()));

        Map<String, Object> db = new LinkedHashMap<>();
        try {
            db.put("up", true);
            db.put("profiles", memory.profileCount());
            db.put("accounts", auth.accountCount());
        } catch (Exception e) {
            db.put("up", false);
        }
        out.put("sqlite", db);

        var sources = knowledge.sources();
        out.put("knowledge", Map.of("documents", knowledge.documentCount(), "chunks", knowledge.chunkCount(),
                "authorities", sources.stream().map(s -> s.get("authority")).toList()));
        out.put("rules", Map.of("taxYears", RulesRepository.SUPPORTED_TAX_YEARS, "defaultTaxYear", rules.defaultTaxYear(),
                "verifiedOn", rules.tax().verifiedOn(), "limitsVerifiedOn", rules.limitsVerifiedOn()));
        out.put("amfi", Map.of("schemes", amfi.all().size(), "navDate", amfi.navDate()));

        boolean llmReady = Boolean.TRUE.equals(ollama.get("up")) && Boolean.TRUE.equals(ollama.get("chatInstalled"));
        out.put("state", !llmReady ? "offline" : Boolean.TRUE.equals(ollama.get("chatLoaded")) ? "ready" : "loading");
        return out;
    }

    private JsonNode get(String url) {
        try {
            var resp = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(2)).build(),
                    HttpResponse.BodyHandlers.ofString());
            return resp.statusCode() == 200 ? json.readTree(resp.body()) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
