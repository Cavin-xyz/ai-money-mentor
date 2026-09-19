package ai.money.mentor.backend.memory;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import ai.money.mentor.backend.engine.Inputs;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final MemoryService memory;

    public ProfileController(MemoryService memory) {
        this.memory = memory;
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String id = memory.createProfile(body);
        return full(id);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String id) {
        return memory.profile(id).isPresent() ? ResponseEntity.ok(full(id)) : ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        memory.updateProfile(id, body);
        return full(id);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> deleteEverything(@PathVariable String id) {
        memory.deleteEverything(id);
        return Map.of("deleted", true);
    }

    @GetMapping("/{id}/goals")
    public List<Map<String, Object>> goals(@PathVariable String id) {
        return memory.goals(id);
    }

    @PostMapping("/{id}/goals")
    public List<Map<String, Object>> addGoal(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String name = Inputs.str(body, "name", "");
        double amount = Inputs.num(body, "amount");
        int years = (int) Inputs.num(body, "years");
        if (name.isBlank() || amount <= 0 || years <= 0) throw new IllegalArgumentException("Goal needs a name, amount and years");
        memory.addGoal(id, name, amount, years);
        return memory.goals(id);
    }

    @DeleteMapping("/{id}/goals/{goalId}")
    public List<Map<String, Object>> deleteGoal(@PathVariable String id, @PathVariable long goalId) {
        memory.deleteGoal(id, goalId);
        return memory.goals(id);
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> history(@PathVariable String id) {
        return memory.history(id, 30);
    }

    @GetMapping("/{id}/history/{interactionId}")
    public ResponseEntity<Map<String, Object>> interaction(@PathVariable String id, @PathVariable long interactionId) {
        return memory.interaction(id, interactionId).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/prefs")
    public Map<String, Object> prefs(@PathVariable String id, @RequestBody Map<String, Object> body) {
        memory.updatePrefs(id, body);
        return memory.prefs(id);
    }

    private Map<String, Object> full(String id) {
        return Map.of(
                "profile", memory.profile(id).orElseThrow(),
                "prefs", memory.prefs(id),
                "goals", memory.goals(id),
                "history", memory.history(id, 30));
    }
}
