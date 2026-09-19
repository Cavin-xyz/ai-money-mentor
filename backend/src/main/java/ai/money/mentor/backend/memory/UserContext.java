package ai.money.mentor.backend.memory;

import java.util.List;
import java.util.Map;

/** What the pipeline knows about the person asking: saved profile, goals, preferences, recent runs. */
public record UserContext(String profileId, Map<String, Object> profile, List<Map<String, Object>> goals,
        String language, String investmentStyle, boolean rememberNumbers, List<String> recentSummaries) {

    public static UserContext anonymous() {
        return new UserContext(null, Map.of(), List.of(), "en", "balanced", false, List.of());
    }

    public boolean hasProfile() {
        return profileId != null && profile != null && !profile.isEmpty();
    }

    public String languageName() {
        return switch (language == null ? "en" : language) {
            case "hi" -> "Hindi";
            case "te" -> "Telugu";
            case "ta" -> "Tamil";
            default -> "English";
        };
    }
}
