package ai.money.mentor.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/couples-planner")
public class CouplesMoneyPlannerController {

    private final CouplesMoneyPlannerService plannerService;

    public CouplesMoneyPlannerController(CouplesMoneyPlannerService plannerService) {
        this.plannerService = plannerService;
    }

    @PostMapping("/insights")
    public ResponseEntity<String> getInsights(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");

        if (prompt == null || prompt.isBlank()) {
            return ResponseEntity.badRequest().body("{\"error\": \"Prompt is required\"}");
        }

        try {
            String aiResponse = plannerService.generateInsights(prompt);
            return ResponseEntity.ok(aiResponse);
        } catch (Exception e) {
            e.printStackTrace();
            String safeError = e.getMessage().replace("\"", "\\\"").replace("\n", " ");
            return ResponseEntity.status(500)
                    .body("{\"error\": \"Failed to generate AI response: " + safeError + "\"}");
        }
    }
}
