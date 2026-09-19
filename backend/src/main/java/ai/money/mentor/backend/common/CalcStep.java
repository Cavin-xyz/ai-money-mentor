package ai.money.mentor.backend.common;

/**
 * One visible step of a deterministic calculation — rendered in the UI's
 * "How we calculated this" panel. {@code source} is set when the step uses a rule value.
 */
public record CalcStep(String group, String label, String formula, String value, String source) {

    public static CalcStep of(String group, String label, String formula, String value) {
        return new CalcStep(group, label, formula, value, null);
    }
}
