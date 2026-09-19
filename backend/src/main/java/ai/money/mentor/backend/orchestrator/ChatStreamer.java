package ai.money.mentor.backend.orchestrator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.context.ContextBuilder;
import ai.money.mentor.backend.llm.LlmUnavailableException;
import ai.money.mentor.backend.llm.LocalLlmService;
import ai.money.mentor.backend.memory.MemoryService;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.rag.Citation;
import ai.money.mentor.backend.rag.KnowledgeService;
import ai.money.mentor.backend.safety.SafetyLayer;
import jakarta.annotation.PreDestroy;

/**
 * Streaming Q&A (Tax Wizard, "Ask about this"): retrieve → stream tokens → post-check the full
 * answer and send citations + trust report. Streamed text can't be retracted, so failed checks
 * surface as warnings on the badge rather than silent edits.
 */
@Service
public class ChatStreamer {

    private static final Logger log = LoggerFactory.getLogger(ChatStreamer.class);

    public record ChatRequest(String module, String instructions, List<Message> history, String question,
            String retrievalQuery, CalcTrace trace, String regimeWinner, String taxYear, String profileId,
            Map<String, Object> rawRequest, Object calcPayload) {
    }

    private final MemoryService memory;
    private final KnowledgeService knowledge;
    private final ContextBuilder contextBuilder;
    private final LocalLlmService llm;
    private final SafetyLayer safety;
    private final ExecutorService executor = Executors.newFixedThreadPool(3);

    public ChatStreamer(MemoryService memory, KnowledgeService knowledge, ContextBuilder contextBuilder,
            LocalLlmService llm, SafetyLayer safety) {
        this.memory = memory;
        this.knowledge = knowledge;
        this.contextBuilder = contextBuilder;
        this.llm = llm;
        this.safety = safety;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public SseEmitter stream(ChatRequest req) {
        var emitter = new SseEmitter(240_000L);
        var ev = new PipelineEvents(emitter);
        executor.execute(() -> {
            try {
                run(req, ev);
            } catch (Exception e) {
                log.error("Chat stream failed", e);
                ev.error("Something went wrong. Please try again.");
            } finally {
                ev.complete();
            }
        });
        return emitter;
    }

    private void run(ChatRequest req, PipelineEvents ev) {
        long t0 = System.currentTimeMillis();
        long t = t0;
        ev.stage("memory", "start", 0, null);
        UserContext user = memory.context(req.profileId());
        ev.stage("memory", "done", System.currentTimeMillis() - t, user.hasProfile() ? "Profile loaded" : "No saved profile");

        CalcTrace trace = req.trace() != null ? req.trace() : new CalcTrace();
        if (req.trace() != null) {
            ev.stage("calc", "start", 0, null);
            ev.send("calc", req.calcPayload() != null ? req.calcPayload() : Map.of("calculations", trace.steps()));
            ev.stage("calc", "done", 0, trace.steps().size() + " calculation steps");
        }

        t = System.currentTimeMillis();
        ev.stage("retrieve", "start", 0, null);
        List<Citation> cites;
        try {
            cites = knowledge.retrieve(req.retrievalQuery(), req.taxYear(), 4);
        } catch (Exception e) {
            cites = List.of();
        }
        ev.send("sources", Map.of("citations", cites));
        ev.stage("retrieve", "done", System.currentTimeMillis() - t, cites.isEmpty() ? "No matching passages" : cites.size() + " official passages");

        t = System.currentTimeMillis();
        ev.stage("llm", "start", 0, llm.chatModel());
        var ctx = contextBuilder.build(req.instructions(), user, trace, cites, req.question());
        List<Message> messages = new ArrayList<>(req.history());
        messages.add(new UserMessage(ctx.user()));
        StringBuilder answer = new StringBuilder();
        List<String> extra = new ArrayList<>();
        String source = "llm";
        try {
            llm.stream(ctx.system(), messages).doOnNext(tok -> {
                answer.append(tok);
                ev.send("token", Map.of("t", tok));
            }).blockLast();
        } catch (LlmUnavailableException e) {
            source = "unavailable";
            extra.add("Local model offline");
            String msg = "The local AI model isn't running right now. " + (cites.isEmpty() ? "" : "Here are the most relevant official passages I found.");
            answer.append(msg);
            ev.send("token", Map.of("t", msg));
        }
        ev.stage("llm", "done", System.currentTimeMillis() - t, answer.length() + " characters");

        t = System.currentTimeMillis();
        ev.stage("safety", "start", 0, null);
        var verdict = safety.check(List.of(answer.toString()), trace, req.rawRequest() == null ? Map.of() : req.rawRequest(),
                cites, req.regimeWinner(), Set.of(), req.taxYear());
        if (!verdict.numbersOk()) extra.add("Some ₹ figures in this answer were not produced by the calculator: " + String.join(", ", verdict.unverified()));
        var trust = safety.report(verdict, true, source, extra);
        ev.stage("safety", "done", System.currentTimeMillis() - t,
                verdict.checks().stream().filter(c -> c.passed()).count() + "/" + verdict.checks().size() + " checks passed");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", verdict.cleanedTexts().isEmpty() ? answer.toString() : verdict.cleanedTexts().get(0));
        result.put("citations", cites);
        result.put("trust", trust);
        result.put("model", llm.chatModel());
        result.put("latencyMs", System.currentTimeMillis() - t0);
        ev.send("result", result);

        try {
            String q = req.question().length() > 80 ? req.question().substring(0, 80) + "…" : req.question();
            memory.saveInteraction(req.profileId(), req.module(), "Asked: " + q, Map.of("question", req.question()), result);
        } catch (Exception e) {
            log.warn("Could not save chat interaction: {}", e.getMessage());
        }
    }
}
