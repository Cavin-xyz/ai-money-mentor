package ai.money.mentor.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tax")
public class TaxWizardController {

    private final TaxWizardService taxWizardService;

    public TaxWizardController(TaxWizardService taxWizardService) {
        this.taxWizardService = taxWizardService;
    }

    @PostMapping("/wizard")
    public ResponseEntity<Map<String, String>> getTaxAdvice(
            @RequestBody Map<String, List<Map<String, Object>>> chatRequest) {
        // Expected payload: { "history": [ { "role": "user", "text": "Hi",
        // "inlineData": {...} } ] }
        List<Map<String, Object>> history = chatRequest.get("history");

        if (history == null || history.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Chat history is required"));
        }

        try {
            String aiResponse = taxWizardService.generateTaxAdvice(history);
            return ResponseEntity.ok(Map.of("response", aiResponse));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to generate AI response: " + e.getMessage()));
        }
    }
}
