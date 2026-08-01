package ai.money.mentor.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/health-score")
public class HealthScoreController {

    private final HealthScoreService healthScoreService;

    public HealthScoreController(HealthScoreService healthScoreService) {
        this.healthScoreService = healthScoreService;
    }

    @PostMapping("/analyze")
    public ResponseEntity<String> analyzeHealth(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");

        if (prompt == null || prompt.isBlank()) {
            return ResponseEntity.badRequest().body("{\"error\": \"Financial data is required\"}");
        }

        try {
            String aiResponse = healthScoreService.analyzeHealth(prompt);
            return ResponseEntity.ok(aiResponse);
        } catch (Exception e) {
            e.printStackTrace();
            String safeError = e.getMessage().replace("\"", "\\\"").replace("\n", " ");
            return ResponseEntity.status(500)
                    .body("{\"error\": \"Failed to generate AI health analysis: " + safeError + "\"}");
        }
    }
}
