package ai.money.mentor.backend.orchestrator;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ai.money.mentor.backend.context.ContextBuilder;
import ai.money.mentor.backend.llm.LlmUnavailableException;
import ai.money.mentor.backend.llm.LocalLlmService;
import ai.money.mentor.backend.memory.MemoryService;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor.Prepared;
import ai.money.mentor.backend.rag.Citation;
import ai.money.mentor.backend.rag.KnowledgeService;
import ai.money.mentor.backend.safety.SafetyLayer;
import ai.money.mentor.backend.safety.TrustReport;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

/**
 * The AI orchestrator. Every module runs the same 7 steps from the architecture diagram:
 * input → memory → deterministic calculation → retrieval → context → local LLM → safety checks,
 * streaming each stage so the UI shows numbers immediately and the explanation as it lands.
 */
@Service
public class AdvisorPipeline {

    private static final Logger log = LoggerFactory.getLogger(AdvisorPipeline.class);
    private static final Pattern CITE = Pattern.compile("\\[S(\\d+)]");

    private final Map<String, ModuleAdvisor> advisors;
    private final MemoryService memory;
    private final KnowledgeService knowledge;
    private final ContextBuilder contextBuilder;
    private final LocalLlmService llm;
    private final SafetyLayer safety;
    private final JsonMapper json;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    public AdvisorPipeline(List<ModuleAdvisor> advisors, MemoryService memory, KnowledgeService knowledge,
            ContextBuilder contextBuilder, LocalLlmService llm, SafetyLayer safety, JsonMapper json) {
        this.advisors = advisors.stream().collect(Collectors.toMap(ModuleAdvisor::module, Function.identity()));
        this.memory = memory;
        this.knowledge = knowledge;
        this.contextBuilder = contextBuilder;
        this.llm = llm;
        this.safety = safety;
        this.json = json;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public boolean supports(String module) {
        return advisors.containsKey(module);
    }

    public SseEmitter stream(String module, Map<String, Object> request, String profileId) {
        return stream(module, request, profileId, null);
    }

    public SseEmitter stream(String module, Map<String, Object> request, String profileId, String language) {
        ModuleAdvisor advisor = advisor(module);
        var emitter = new SseEmitter(240_000L);
        var events = new PipelineEvents(emitter);
        executor.execute(() -> {
            try {
                run(advisor, request, profileId, language, events);
            } catch (IllegalArgumentException e) {
                events.error(e.getMessage());
            } catch (Exception e) {
                log.error("Pipeline failed for {}", module, e);
                events.error("Something went wrong while preparing your guidance. Please try again.");
            } finally {
                events.complete();
            }
        });
        return emitter;
    }

    public ObjectNode runSync(String module, Map<String, Object> request, String profileId, String language) {
        return run(advisor(module), request, profileId, language, PipelineEvents.none());
    }

    /** Engine only — instant, no retrieval, no LLM (used by what-if toggles). */
    public ObjectNode calcOnly(String module, Map<String, Object> request, String profileId, String language) {
        var user = memory.context(profileId).withLanguage(language);
        Prepared p = advisor(module).prepare(request, user);
        ObjectNode out = p.result();
        out.set("meta", meta(p, List.of(), null, "calculation-only", 0));
        return out;
    }

    ObjectNode run(ModuleAdvisor advisor, Map<String, Object> request, String profileId, String language, PipelineEvents ev) {
        long t0 = System.currentTimeMillis();

        // 2. Memory
        long t = System.currentTimeMillis();
        ev.stage("memory", "start", 0, null);
        UserContext user = memory.context(profileId).withLanguage(language);
        ev.stage("memory", "done", System.currentTimeMillis() - t, user.hasProfile() ? "Profile, goals & history loaded" : "No saved profile");

        // 3. Deterministic calculation
        t = System.currentTimeMillis();
        ev.stage("calc", "start", 0, null);
        Prepared p = advisor.prepare(request, user);
        ObjectNode partial = p.result().deepCopy();
        partial.set("meta", meta(p, List.of(), null, "pending", System.currentTimeMillis() - t0));
        ev.send("calc", partial);
        ev.stage("calc", "done", System.currentTimeMillis() - t, p.trace().steps().size() + " calculation steps");

        // 4. Retrieval
        t = System.currentTimeMillis();
        ev.stage("retrieve", "start", 0, null);
        List<Citation> cites = retrieve(p.query(), p.taxYear());
        ev.send("sources", Map.of("citations", cites));
        ev.stage("retrieve", "done", System.currentTimeMillis() - t, cites.isEmpty() ? "No matching passages" : cites.size() + " official passages");

        // 5–7. Context → local LLM → safety
        ObjectNode result = p.result();
        String source = "template";
        TrustReport trust;
        var task = p.narrative();
        Set<String> owned = ownedProducts(request);
        if (task == null) {
            var v = safety.check(List.of(), p.trace(), request, cites, p.regimeWinner(), owned, p.taxYear());
            trust = safety.report(v, true, "calculation-only", List.of());
        } else {
            t = System.currentTimeMillis();
            ev.stage("llm", "start", 0, llm.structuredModel());
            var ctx = contextBuilder.build(task.instructions(), user, p.trace(), cites,
                    "Return JSON for the schema. Only the text fields — the numbers are already on screen.");
            Object narrative = null;
            boolean outputOk = true;
            List<String> extra = new ArrayList<>();
            SafetyLayer.Verdict verdict = null;
            try {
                narrative = llm.generate(ctx.system(), ctx.user(), task.schema());
                ev.stage("llm", "done", System.currentTimeMillis() - t, "Explanation drafted");
                long ts = System.currentTimeMillis();
                ev.stage("safety", "start", 0, null);
                verdict = safety.check(task.textsOf(narrative), p.trace(), request, cites, p.regimeWinner(), owned, p.taxYear());
                if (!verdict.acceptable()) {
                    ev.stage("safety", "retry", System.currentTimeMillis() - ts, "Asking the model to fix: " + failed(verdict));
                    narrative = llm.generate(ctx.system(), ctx.user() + "\n\n" + safety.retryFeedback(verdict, p.trace()), task.schema());
                    verdict = safety.check(task.textsOf(narrative), p.trace(), request, cites, p.regimeWinner(), owned, p.taxYear());
                }
                if (verdict.acceptable() || onlySourceIssues(verdict)) {
                    task.mergeInto(result, stripInvalidCitations(narrative, cites.size(), task.schema()));
                    source = "llm";
                } else {
                    extra.add("Model text failed checks twice — showing the calculator's own explanation");
                }
                ev.stage("safety", "done", System.currentTimeMillis() - ts,
                        verdict.checks().stream().filter(c -> c.passed()).count() + "/" + verdict.checks().size() + " checks passed");
            } catch (LlmUnavailableException e) {
                extra.add("Local model offline — explanation from templates");
                ev.stage("llm", "done", System.currentTimeMillis() - t, "Model offline — using templates");
            } catch (RuntimeException e) {
                log.warn("Narrative generation failed for {}: {}", advisor.module(), e.getMessage());
                outputOk = false;
                extra.add("Model output was malformed — explanation from templates");
                ev.stage("llm", "done", System.currentTimeMillis() - t, "Malformed output — using templates");
            }
            if (verdict == null) verdict = safety.check(List.of(), p.trace(), request, cites, p.regimeWinner(), owned, p.taxYear());
            trust = safety.report(verdict, outputOk, source, extra);
        }

        result.set("meta", meta(p, cites, trust, source, System.currentTimeMillis() - t0));
        ev.send("result", result);

        // Memory write-back
        try {
            memory.rememberFrom(profileId, request);
            memory.saveInteraction(profileId, advisor.module(), p.summary(), request, result);
        } catch (Exception e) {
            log.warn("Could not save interaction: {}", e.getMessage());
        }
        return result;
    }

    private ObjectNode meta(Prepared p, List<Citation> cites, TrustReport trust, String source, long latencyMs) {
        ObjectNode m = json.createObjectNode();
        m.set("calculations", json.valueToTree(p.trace().steps()));
        m.set("assumptions", json.valueToTree(p.trace().assumptions()));
        m.set("citations", json.valueToTree(cites));
        if (trust != null) m.set("trust", json.valueToTree(trust));
        m.put("model", llm.structuredModel());
        m.put("explanationSource", source);
        m.put("taxYear", p.taxYear());
        m.put("latencyMs", latencyMs);
        return m;
    }

    private List<Citation> retrieve(String query, String taxYear) {
        try {
            return knowledge.retrieve(query, taxYear, 4);
        } catch (Exception e) {
            log.warn("Retrieval failed: {}", e.getMessage());
            return List.of();
        }
    }

    private Object stripInvalidCitations(Object narrative, int max, Class<?> type) {
        JsonNode tree = json.valueToTree(narrative);
        return json.treeToValue(clean(tree, max), type);
    }

    private JsonNode clean(JsonNode node, int max) {
        if (node.isString()) {
            Matcher m = CITE.matcher(node.asString());
            StringBuilder sb = new StringBuilder();
            while (m.find()) {
                int n = Integer.parseInt(m.group(1));
                m.appendReplacement(sb, n >= 1 && n <= max ? Matcher.quoteReplacement(m.group()) : "");
            }
            m.appendTail(sb);
            return StringNode.valueOf(sb.toString().replaceAll(" {2,}", " ").trim());
        }
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            for (String k : new ArrayList<>(o.propertyNames())) o.set(k, clean(o.get(k), max));
            return o;
        }
        if (node.isArray()) {
            var a = json.createArrayNode();
            node.forEach(n -> a.add(clean(n, max)));
            return a;
        }
        return node;
    }

    private static boolean onlySourceIssues(SafetyLayer.Verdict v) {
        return v.checks().stream().filter(c -> !c.passed()).allMatch(c -> "source".equals(c.key()));
    }

    private static String failed(SafetyLayer.Verdict v) {
        return v.checks().stream().filter(c -> !c.passed()).map(c -> c.label()).collect(Collectors.joining(", "));
    }

    @SuppressWarnings("unchecked")
    private static Set<String> ownedProducts(Map<String, Object> request) {
        Set<String> out = new HashSet<>();
        if (request.get("holdings") instanceof List<?> l) {
            for (Object h : l) if (h instanceof Map<?, ?> m && m.get("name") != null) out.add(m.get("name").toString());
        }
        return out;
    }

    private ModuleAdvisor advisor(String module) {
        ModuleAdvisor a = advisors.get(module);
        if (a == null) throw new IllegalArgumentException("Unknown module: " + module);
        return a;
    }
}
