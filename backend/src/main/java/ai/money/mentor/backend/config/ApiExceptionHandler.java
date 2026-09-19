package ai.money.mentor.backend.config;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import ai.money.mentor.backend.auth.AuthService.AuthException;
import ai.money.mentor.backend.llm.LlmUnavailableException;

/** One error shape for every endpoint: {"error": "..."} — never a raw stack or exception message. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(LlmUnavailableException.class)
    public ResponseEntity<Map<String, String>> llmDown(LlmUnavailableException e) {
        log.warn("Local model unavailable: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "The local AI model is starting up or not running. Try again in a few seconds."));
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, String>> auth(AuthException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    /** Keeps deliberate status codes (403 for someone else's profile) out of the catch-all below. */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> status(org.springframework.web.server.ResponseStatusException e) {
        String reason = e.getReason() == null ? "Request refused" : e.getReason();
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", reason));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> unexpected(Exception e) {
        log.error("Unhandled error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Something went wrong while preparing your guidance. Please try again."));
    }
}
