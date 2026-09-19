package ai.money.mentor.backend.engine;

import java.util.List;
import java.util.Map;

import ai.money.mentor.backend.common.Money;

/** Lenient readers for form payloads: the UI sends numbers as strings ("5,00,000", "", "Yes"). */
public final class Inputs {

    private Inputs() {
    }

    public static double num(Map<String, ?> m, String key) {
        return m == null ? 0 : Money.parse(m.get(key));
    }

    public static double num(Map<String, ?> m, String key, double fallback) {
        if (m == null || m.get(key) == null || m.get(key).toString().isBlank()) return fallback;
        double v = Money.parse(m.get(key));
        return v == 0 && !"0".equals(m.get(key).toString().trim()) ? fallback : v;
    }

    public static boolean yes(Map<String, ?> m, String key) {
        if (m == null || m.get(key) == null) return false;
        Object v = m.get(key);
        if (v instanceof Boolean b) return b;
        String s = v.toString().trim().toLowerCase();
        return s.equals("yes") || s.equals("true") || s.equals("y");
    }

    public static String str(Map<String, ?> m, String key, String fallback) {
        if (m == null || m.get(key) == null || m.get(key).toString().isBlank()) return fallback;
        return m.get(key).toString().trim();
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Map<String, ?> m, String key) {
        return m != null && m.get(key) instanceof Map<?, ?> x ? (Map<String, Object>) x : Map.of();
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> list(Map<String, ?> m, String key) {
        return m != null && m.get(key) instanceof List<?> x ? (List<Map<String, Object>>) x : List.of();
    }
}
