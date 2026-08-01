package ai.money.mentor.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/fire")
public class FirePlannerController {

    private final FirePlannerService firePlannerService;

    public FirePlannerController(FirePlannerService firePlannerService) {
        this.firePlannerService = firePlannerService;
    }

    @PostMapping("/planner")
    public ResponseEntity<Map<String, String>> getFirePlan(@RequestBody Map<String, Object> userProfile) {
        if (userProfile == null || userProfile.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "User profile data is required"));
        }

        try {
            String aiResponse = firePlannerService.generateFirePlan(userProfile);
            return ResponseEntity.ok(Map.of("response", aiResponse));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Failed to generate FIRE plan: " + e.getMessage()));
        }
    }
}
