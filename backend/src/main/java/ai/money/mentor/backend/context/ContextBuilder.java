package ai.money.mentor.backend.context;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcStep;
import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.Inputs;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.rag.Citation;

/**
 * Builds the model's input from four blocks — SYSTEM rules, USER MEMORY, CALCULATIONS (engine
 * output, authoritative) and SOURCES (retrieved official passages, citable as [S1]…).
 */
@Component
public class ContextBuilder {

    public record BuiltContext(String system, String user) {
    }

    private static final String BASE_RULES = """
            You are Money Mentor, a private on-device financial guide for people in India.
            You EXPLAIN results; you never calculate. Follow these rules strictly:
            1. Numbers: use ONLY figures that appear in CALCULATIONS, copied exactly as written
               (₹ with Indian digit grouping). Never compute, round differently, or invent a number.
            2. Rules and legal facts must come from SOURCES; cite them inline as [S1], [S2].
               If the sources do not cover something, do not state it as fact.
            3. Guidance, not advice: suggest fund CATEGORIES (e.g. "Nifty 50 index fund"), never a named
               scheme or fund house. No guarantees about returns.
            4. Section numbers: say "Section 123 (formerly 80C)" style when both are known.
            5. Warm, plain language. Short sentences. Explain jargon once.
            """;

    public BuiltContext build(String instructions, UserContext user, CalcTrace trace, List<Citation> sources,
            String task) {
        String language = user.languageName();
        String system = BASE_RULES
                + (!"English".equals(language)
                        ? "6. Write every text field in " + language + ". Keep digits, ₹ amounts and section numbers exactly as given.\n"
                        : "")
                + "\n" + instructions;

        StringBuilder u = new StringBuilder();
        u.append("USER MEMORY:\n").append(memory(user)).append('\n');
        u.append("CALCULATIONS (from the deterministic engine — authoritative):\n").append(calculations(trace)).append('\n');
        u.append("SOURCES:\n");
        if (sources.isEmpty()) u.append("(none retrieved — do not cite; avoid stating legal rules)\n");
        for (var s : sources) {
            u.append('[').append(s.id()).append("] ").append(s.authority()).append(" — ").append(s.title());
            if (s.section() != null) u.append(" · Sec ").append(s.section()).append(s.sectionOld() != null ? " (formerly " + s.sectionOld() + ")" : "");
            u.append("\n").append(s.snippet()).append("\n\n");
        }
        u.append("TASK: ").append(task);
        return new BuiltContext(system, u.toString());
    }

    static String memory(UserContext user) {
        if (!user.hasProfile()) return "- No saved profile (anonymous session)\n";
        Map<String, Object> p = user.profile();
        StringBuilder s = new StringBuilder("- ");
        s.append(p.getOrDefault("name", "User"));
        if (p.get("age") != null) s.append(", age ").append(p.get("age"));
        if (p.get("city") != null) s.append(", ").append(p.get("city"));
        if (Inputs.num(p, "monthlyIncome") > 0) s.append(", income ").append(Money.inr(Inputs.num(p, "monthlyIncome"))).append("/mo");
        if (p.get("riskTolerance") != null) s.append(", risk tolerance ").append(p.get("riskTolerance"));
        s.append(", prefers ").append(user.investmentStyle()).append(" investing\n");
        for (var g : user.goals()) {
            s.append("- Goal: ").append(g.get("name")).append(" — ").append(Money.compact(Inputs.num(g, "amount")))
                    .append(" in ").append(g.get("years")).append(" years\n");
        }
        for (String r : user.recentSummaries()) s.append("- Earlier: ").append(r).append('\n');
        return s.toString();
    }

    /** Human-readable calculation lines; slab-by-slab tax detail is omitted to save context. */
    static String calculations(CalcTrace trace) {
        StringBuilder s = new StringBuilder();
        String group = null;
        int n = 0;
        for (CalcStep step : trace.steps()) {
            if (step.label().startsWith("Slab ")) continue;
            if (!step.group().equals(group)) {
                group = step.group();
                s.append("## ").append(group).append('\n');
            }
            s.append("- ").append(step.label()).append(": ").append(step.value());
            if (step.formula() != null && !step.formula().isBlank() && !"rule".equals(step.formula()) && step.formula().length() < 90) {
                s.append("  (").append(step.formula()).append(')');
            }
            s.append('\n');
            if (++n >= 45) break;
        }
        for (String a : trace.assumptions()) s.append("- Assumption: ").append(a).append('\n');
        return s.toString();
    }
}
