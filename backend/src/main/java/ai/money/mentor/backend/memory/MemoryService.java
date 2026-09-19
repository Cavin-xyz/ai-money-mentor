package ai.money.mentor.backend.memory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Persistent user memory: profile, goals, interaction history and preferences, in a local
 * SQLite file. No login — a profile id lives in the browser; "Delete my data" wipes every row.
 */
@Service
public class MemoryService {

    /** Fields modules may remember, with the module-field → profile-field renames. */
    private static final Map<String, String> REMEMBERED = Map.ofEntries(
            Map.entry("currentAge", "age"), Map.entry("age", "age"),
            Map.entry("retirementAge", "retirementAge"), Map.entry("targetRetirementAge", "retirementAge"),
            Map.entry("monthlyIncome", "monthlyIncome"), Map.entry("monthlyExpenses", "monthlyExpenses"),
            Map.entry("annualBonus", "annualBonus"), Map.entry("currentSavings", "currentSavings"),
            Map.entry("existingSips", "existingSips"), Map.entry("ppfEpfBalance", "ppfEpfBalance"),
            Map.entry("emergencyFund", "emergencyFund"), Map.entry("liquidSavings", "liquidSavings"),
            Map.entry("dependents", "dependents"), Map.entry("lifeCover", "lifeCover"),
            Map.entry("healthCover", "healthCover"), Map.entry("monthlyEmi", "monthlyEmi"),
            Map.entry("retirementCorpus", "retirementCorpus"), Map.entry("equityPct", "equityPct"),
            Map.entry("city", "city"), Map.entry("riskTolerance", "riskTolerance"), Map.entry("name", "name"));

    private static final Set<String> MODULE_LABELS = Set.of("fire", "health-score", "tax", "life-event", "couples-planner", "portfolio", "scam-shield", "schemes", "ask");

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public MemoryService(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    // ── profile ─────────────────────────────────────────────────────

    public String createProfile(Map<String, Object> fields) {
        String id = UUID.randomUUID().toString();
        String now = Instant.now().toString();
        Map<String, Object> data = filter(fields);
        jdbc.sql("INSERT INTO user_profile(id, name, data_json, remember_numbers, created_at, updated_at) VALUES (?,?,?,?,?,?)")
                .params(id, String.valueOf(fields.getOrDefault("name", "Me")), json.writeValueAsString(data), 1, now, now)
                .update();
        jdbc.sql("INSERT INTO user_pref(profile_id) VALUES (?)").param(id).update();
        return id;
    }

    public Optional<Map<String, Object>> profile(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        return jdbc.sql("SELECT id, name, data_json, remember_numbers, created_at, updated_at FROM user_profile WHERE id = ?")
                .param(id)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>(readMap(rs.getString("data_json")));
                    m.put("id", rs.getString("id"));
                    m.put("name", rs.getString("name"));
                    m.put("rememberNumbers", rs.getInt("remember_numbers") == 1);
                    m.put("createdAt", rs.getString("created_at"));
                    m.put("updatedAt", rs.getString("updated_at"));
                    return m;
                })
                .optional();
    }

    public void updateProfile(String id, Map<String, Object> fields) {
        var current = profile(id).orElseThrow(() -> new IllegalArgumentException("Profile not found"));
        Map<String, Object> data = filter(current);
        filter(fields).forEach((k, v) -> {
            if (v == null || v.toString().isBlank()) data.remove(k);
            else data.put(k, v);
        });
        String name = fields.containsKey("name") ? String.valueOf(fields.get("name")) : String.valueOf(current.get("name"));
        Object remember = fields.get("rememberNumbers");
        jdbc.sql("UPDATE user_profile SET name = ?, data_json = ?, remember_numbers = COALESCE(?, remember_numbers), updated_at = ? WHERE id = ?")
                .params(name, json.writeValueAsString(data), remember == null ? null : (Boolean.TRUE.equals(remember) ? 1 : 0),
                        Instant.now().toString(), id)
                .update();
    }

    /** Called by the pipeline after a module run, only when the user left "Remember my numbers" on. */
    public void rememberFrom(String id, Map<String, Object> request) {
        if (id == null) return;
        var p = profile(id);
        if (p.isEmpty() || !Boolean.TRUE.equals(p.get().get("rememberNumbers"))) return;
        Map<String, Object> updates = new LinkedHashMap<>();
        request.forEach((k, v) -> {
            String target = REMEMBERED.get(k);
            if (target != null && v != null && !v.toString().isBlank() && !"name".equals(target)) updates.put(target, v);
        });
        if (!updates.isEmpty()) updateProfile(id, updates);
    }

    // ── goals ───────────────────────────────────────────────────────

    public List<Map<String, Object>> goals(String id) {
        return jdbc.sql("SELECT id, name, target_amount, years, created_at FROM financial_goal WHERE profile_id = ? ORDER BY id")
                .param(id)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("name", rs.getString("name"));
                    m.put("amount", rs.getDouble("target_amount"));
                    m.put("years", rs.getInt("years"));
                    return m;
                })
                .list();
    }

    public long addGoal(String id, String name, double amount, int years) {
        requireProfile(id);
        jdbc.sql("INSERT INTO financial_goal(profile_id, name, target_amount, years, created_at) VALUES (?,?,?,?,?)")
                .params(id, name, amount, years, Instant.now().toString()).update();
        return jdbc.sql("SELECT last_insert_rowid()").query(Long.class).single();
    }

    public void deleteGoal(String id, long goalId) {
        jdbc.sql("DELETE FROM financial_goal WHERE id = ? AND profile_id = ?").params(goalId, id).update();
    }

    // ── history ─────────────────────────────────────────────────────

    public void saveInteraction(String id, String module, String summary, Object input, Object result) {
        if (id == null || profile(id).isEmpty()) return;
        jdbc.sql("INSERT INTO interaction(profile_id, module, summary, input_json, result_json, created_at) VALUES (?,?,?,?,?,?)")
                .params(id, module, summary, json.writeValueAsString(input), json.writeValueAsString(result), Instant.now().toString())
                .update();
    }

    public List<Map<String, Object>> history(String id, int limit) {
        return jdbc.sql("SELECT id, module, summary, created_at FROM interaction WHERE profile_id = ? ORDER BY id DESC LIMIT ?")
                .params(id, limit)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("module", rs.getString("module"));
                    m.put("summary", rs.getString("summary"));
                    m.put("createdAt", rs.getString("created_at"));
                    return m;
                })
                .list();
    }

    public Optional<Map<String, Object>> interaction(String id, long interactionId) {
        return jdbc.sql("SELECT module, summary, input_json, result_json, created_at FROM interaction WHERE id = ? AND profile_id = ?")
                .params(interactionId, id)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("module", rs.getString("module"));
                    m.put("summary", rs.getString("summary"));
                    m.put("input", json.readValue(rs.getString("input_json"), Object.class));
                    m.put("result", json.readValue(rs.getString("result_json"), Object.class));
                    m.put("createdAt", rs.getString("created_at"));
                    return m;
                })
                .optional();
    }

    // ── preferences ─────────────────────────────────────────────────

    public Map<String, Object> prefs(String id) {
        return jdbc.sql("SELECT language, investment_style, notifications FROM user_pref WHERE profile_id = ?")
                .param(id)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("language", rs.getString("language"));
                    m.put("investmentStyle", rs.getString("investment_style"));
                    m.put("notifications", rs.getInt("notifications") == 1);
                    return m;
                })
                .optional()
                .orElse(Map.of("language", "en", "investmentStyle", "balanced", "notifications", false));
    }

    public void updatePrefs(String id, Map<String, Object> prefs) {
        requireProfile(id);
        var cur = prefs(id);
        String lang = String.valueOf(prefs.getOrDefault("language", cur.get("language")));
        if (!Set.of("en", "hi", "te", "ta").contains(lang)) throw new IllegalArgumentException("Unsupported language");
        String style = String.valueOf(prefs.getOrDefault("investmentStyle", cur.get("investmentStyle")));
        boolean notif = Boolean.TRUE.equals(prefs.getOrDefault("notifications", cur.get("notifications")));
        jdbc.sql("INSERT INTO user_pref(profile_id, language, investment_style, notifications) VALUES (?,?,?,?) "
                + "ON CONFLICT(profile_id) DO UPDATE SET language = excluded.language, investment_style = excluded.investment_style, notifications = excluded.notifications")
                .params(id, lang, style, notif ? 1 : 0).update();
    }

    // ── delete my data ──────────────────────────────────────────────

    @Transactional
    public void deleteEverything(String id) {
        jdbc.sql("DELETE FROM interaction WHERE profile_id = ?").param(id).update();
        jdbc.sql("DELETE FROM financial_goal WHERE profile_id = ?").param(id).update();
        jdbc.sql("DELETE FROM user_pref WHERE profile_id = ?").param(id).update();
        jdbc.sql("DELETE FROM auth_session WHERE account_id IN (SELECT id FROM user_account WHERE profile_id = ?)").param(id).update();
        jdbc.sql("DELETE FROM user_account WHERE profile_id = ?").param(id).update();
        jdbc.sql("DELETE FROM user_profile WHERE id = ?").param(id).update();
    }

    public int profileCount() {
        return jdbc.sql("SELECT COUNT(*) FROM user_profile").query(Integer.class).single();
    }

    // ── context for the pipeline ────────────────────────────────────

    public UserContext context(String id) {
        var p = profile(id);
        if (p.isEmpty()) return UserContext.anonymous();
        var prefs = prefs(id);
        List<String> recent = new ArrayList<>();
        for (var h : history(id, 3)) {
            recent.add(h.get("module") + ": " + h.get("summary") + " (" + h.get("createdAt").toString().substring(0, 10) + ")");
        }
        return new UserContext(id, p.get(), goals(id), String.valueOf(prefs.get("language")),
                String.valueOf(prefs.get("investmentStyle")), Boolean.TRUE.equals(p.get().get("rememberNumbers")), recent);
    }

    public static boolean knownModule(String m) {
        return MODULE_LABELS.contains(m);
    }

    private void requireProfile(String id) {
        if (profile(id).isEmpty()) throw new IllegalArgumentException("Profile not found");
    }

    private Map<String, Object> filter(Map<String, Object> in) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (in == null) return out;
        in.forEach((k, v) -> {
            String target = REMEMBERED.get(k);
            if (target != null && !"name".equals(target)) out.put(target, v);
        });
        return out;
    }

    private Map<String, Object> readMap(String s) {
        if (s == null || s.isBlank()) return new LinkedHashMap<>();
        return json.readValue(s, new TypeReference<LinkedHashMap<String, Object>>() {
        });
    }
}
