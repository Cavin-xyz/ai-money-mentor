package ai.money.mentor.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioXRayController {

    private final PortfolioXRayService portfolioXRayService;

    public PortfolioXRayController(PortfolioXRayService portfolioXRayService) {
        this.portfolioXRayService = portfolioXRayService;
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/analyze")
    public ResponseEntity<Map<String, String>> analyzePortfolio(@RequestBody Map<String, Object> request) {
        String prompt = (String) request.getOrDefault("prompt", "");
        Map<String, Object> inlineData = (Map<String, Object>) request.getOrDefault("inlineData", null);

        if ((prompt == null || prompt.isBlank()) && inlineData == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Portfolio data or file upload is required"));
        }

        try {
            String aiResponse = portfolioXRayService.analyzePortfolio(prompt, inlineData);
            return ResponseEntity.ok(Map.of("response", aiResponse));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to analyze portfolio: " + e.getMessage()));
        }
    }
}
