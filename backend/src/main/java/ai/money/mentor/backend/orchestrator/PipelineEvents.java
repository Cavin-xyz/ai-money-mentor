package ai.money.mentor.backend.orchestrator;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Streams pipeline progress to the browser as Server-Sent Events. A null emitter makes it a no-op (sync/calc calls). */
public class PipelineEvents {

    private final SseEmitter emitter;
    private volatile boolean open = true;

    public PipelineEvents(SseEmitter emitter) {
        this.emitter = emitter;
        if (emitter != null) {
            emitter.onCompletion(() -> open = false);
            emitter.onTimeout(() -> open = false);
            emitter.onError(e -> open = false);
        }
    }

    public static PipelineEvents none() {
        return new PipelineEvents(null);
    }

    public void stage(String step, String status, long ms, String detail) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("step", step);
        m.put("status", status);
        m.put("ms", ms);
        if (detail != null) m.put("detail", detail);
        send("stage", m);
    }

    public void send(String event, Object data) {
        if (emitter == null || !open) return;
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            open = false; // browser went away; keep computing so history is still saved
        }
    }

    public void error(String message) {
        send("error", Map.of("message", message));
    }

    public void complete() {
        if (emitter != null && open) {
            try {
                emitter.complete();
            } catch (IllegalStateException ignored) {
                // already completed
            }
        }
    }
}
