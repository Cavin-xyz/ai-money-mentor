package ai.money.mentor.backend.memory;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import ai.money.mentor.backend.auth.AuthFilter;
import ai.money.mentor.backend.auth.AuthService;
import ai.money.mentor.backend.engine.Inputs;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final MemoryService memory;
    private final AuthService auth;

    public ProfileController(MemoryService memory, AuthService auth) {
        this.memory = memory;
        this.auth = auth;
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        String id = memory.createProfile(body);
        return full(id);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String id, HttpServletRequest request) {
        owns(id, request);
        return memory.profile(id).isPresent() ? ResponseEntity.ok(full(id)) : ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        owns(id, request);
        memory.updateProfile(id, body);
        return full(id);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> deleteEverything(@PathVariable String id, HttpServletRequest request) {
        owns(id, request);
        auth.findByProfile(id).ifPresent(a -> auth.logoutEverywhere(a.id()));
        memory.deleteEverything(id);
        return Map.of("deleted", true);
    }

    @GetMapping("/{id}/goals")
    public List<Map<String, Object>> goals(@PathVariable String id, HttpServletRequest request) {
        owns(id, request);
        return memory.goals(id);
    }

    @PostMapping("/{id}/goals")
    public List<Map<String, Object>> addGoal(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        owns(id, request);
        String name = Inputs.str(body, "name", "");
        double amount = Inputs.num(body, "amount");
        int years = (int) Inputs.num(body, "years");
        if (name.isBlank() || amount <= 0 || years <= 0) throw new IllegalArgumentException("Goal needs a name, amount and years");
        memory.addGoal(id, name, amount, years);
        return memory.goals(id);
    }

    @DeleteMapping("/{id}/goals/{goalId}")
    public List<Map<String, Object>> deleteGoal(@PathVariable String id, @PathVariable long goalId, HttpServletRequest request) {
        owns(id, request);
        memory.deleteGoal(id, goalId);
        return memory.goals(id);
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> history(@PathVariable String id, HttpServletRequest request) {
        owns(id, request);
        return memory.history(id, 30);
    }

    @GetMapping("/{id}/history/{interactionId}")
    public ResponseEntity<Map<String, Object>> interaction(@PathVariable String id, @PathVariable long interactionId,
            HttpServletRequest request) {
        owns(id, request);
        return memory.interaction(id, interactionId).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/prefs")
    public Map<String, Object> prefs(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        owns(id, request);
        memory.updatePrefs(id, body);
        return memory.prefs(id);
    }

    /**
     * A signed-in request may only touch its own profile. A guest request (no session) may touch
     * any profile that no account owns — that is the offline demo, where the id in the browser is
     * the only key there is.
     */
    private void owns(String id, HttpServletRequest request) {
        var account = AuthFilter.account(request);
        boolean allowed = account.map(a -> a.profileId().equals(id))
                .orElseGet(() -> auth.findByProfile(id).isEmpty());
        if (!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That profile belongs to another account");
    }

    private Map<String, Object> full(String id) {
        return Map.of(
                "profile", memory.profile(id).orElseThrow(),
                "prefs", memory.prefs(id),
                "goals", memory.goals(id),
                "history", memory.history(id, 30));
    }
}
