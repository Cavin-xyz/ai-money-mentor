package ai.money.mentor.backend.orchestrator;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.databind.node.ObjectNode;

/**
 * One set of endpoints for every advisor module:
 *   POST /api/{module}/stream  — full pipeline as Server-Sent Events
 *   POST /api/{module}/calc    — deterministic engine only (instant what-ifs)
 *   POST /api/{module}/run     — full pipeline, single JSON response (fallback)
 */
@RestController
@RequestMapping("/api")
public class PipelineController {

    private final AdvisorPipeline pipeline;

    public PipelineController(AdvisorPipeline pipeline) {
        this.pipeline = pipeline;
    }

    @PostMapping(path = "/{module}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String module, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Profile-Id", required = false) String profileId) {
        return pipeline.stream(module, body, profileId);
    }

    @PostMapping("/{module}/calc")
    public ObjectNode calc(@PathVariable String module, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Profile-Id", required = false) String profileId) {
        return pipeline.calcOnly(module, body, profileId);
    }

    @PostMapping("/{module}/run")
    public ObjectNode run(@PathVariable String module, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Profile-Id", required = false) String profileId) {
        return pipeline.runSync(module, body, profileId);
    }
}
