package ai.money.mentor.backend.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Collects calculation steps and every number the engine produced. The number set is what the
 * Safety layer checks LLM text against: a ₹ figure the engine never computed cannot be shown.
 */
public class CalcTrace {

    private final List<CalcStep> steps = new ArrayList<>();
    private final Map<String, Double> facts = new LinkedHashMap<>();
    private final List<String> assumptions = new ArrayList<>();
    private String group = "Calculation";

    public CalcTrace group(String group) {
        this.group = group;
        return this;
    }

    public CalcTrace step(String label, String formula, String value) {
        steps.add(new CalcStep(group, label, formula, value, null));
        return this;
    }

    public CalcTrace rule(String label, String value, String source) {
        steps.add(new CalcStep(group, label, "rule", value, source));
        return this;
    }

    /** Records a number (rupees, %, months, years…) the explanation is allowed to quote. */
    public double fact(String key, double value) {
        facts.put(key, value);
        return value;
    }

    public CalcTrace assume(String assumption) {
        if (!assumptions.contains(assumption)) assumptions.add(assumption);
        return this;
    }

    public void absorb(CalcTrace other) {
        steps.addAll(other.steps);
        other.facts.forEach(facts::putIfAbsent);
        other.assumptions.forEach(this::assume);
    }

    public List<CalcStep> steps() {
        return steps;
    }

    public Map<String, Double> facts() {
        return facts;
    }

    public List<String> assumptions() {
        return assumptions;
    }
}
