package ai.money.mentor.backend.modules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.LifeEventEngine;
import ai.money.mentor.backend.engine.LifeEventEngine.Item;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class LifeEventModule implements ModuleAdvisor {

    public record LifeNarrative(
            @JsonPropertyDescription("max 10 words") String headline,
            @JsonPropertyDescription("2-3 sentences on the tax impact") String taxDescription,
            @JsonPropertyDescription("Exactly 3, one per immediate action, same order") List<String> immediateDescriptions,
            @JsonPropertyDescription("Exactly 3, one per allocation, same order") List<String> longTermDescriptions,
            @JsonPropertyDescription("Exactly 4 short checklist items") List<String> checklist,
            @JsonPropertyDescription("1 sentence on the FIRE impact") String fireImpact) {
    }

    private static final Map<String, String> QUERIES = Map.of(
            "bonus", "bonus salary income tax TDS regime slab",
            "marriage", "gift received on marriage exempt tax clubbing income spouse",
            "baby", "Sukanya Samriddhi account deposit deduction Section 123 80C term insurance",
            "inheritance", "inheritance tax capital gains inherited property cost of acquisition",
            "job_change", "EPF transfer withdrawal taxable gratuity employer NPS contribution 80CCD(2)",
            "home", "home loan interest deduction 24(b) Section 22 principal 80C housing loan LTV RBI");

    private final LifeEventEngine engine;
    private final RulesRepository rules;
    private final JsonMapper json;

    public LifeEventModule(LifeEventEngine engine, RulesRepository rules, JsonMapper json) {
        this.engine = engine;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "life-event";
    }

    @Override
    public String label() {
        return "Life Event Advisor";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        var c = engine.calculate(request, user.hasProfile() ? user.profile() : null);
        ObjectNode r = json.createObjectNode();
        r.put("eventType", c.eventType());
        r.put("headline", "Your plan for: " + c.eventLabel());
        r.putObject("taxImpact").put("estimatedLiability", Money.inr(c.taxLiability())).put("priority", c.taxPriority())
                .put("description", c.taxFacts());
        items(r.putArray("immediateActions"), c.immediateActions());
        items(r.putArray("longTermAllocation"), c.longTermAllocation());
        r.putObject("healthImpact").put("before", c.healthBefore()).put("after", c.healthAfter())
                .put("points", c.healthAfter() - c.healthBefore());
        r.put("fireImpact", c.fireFacts());
        ArrayNode cl = r.putArray("checklist");
        c.checklist().forEach(cl::add);
        r.put("profileUsed", c.profileUsed());
        r.put("annualIncome", Math.round(c.annualIncome()));

        var task = new NarrativeTask<>(LifeNarrative.class, """
                MODULE: Life Event Advisor — event: %s.
                Rewrite the plan in plain, warm language. Facts per item are in CALCULATIONS; keep every figure identical.
                immediateDescriptions: 3 items for: %s.
                longTermDescriptions: 3 items for: %s.
                checklist: 4 practical to-dos for this event in India.""".formatted(c.eventLabel(),
                String.join("; ", c.immediateActions().stream().map(Item::title).toList()),
                String.join("; ", c.longTermAllocation().stream().map(Item::title).toList())),
                n -> {
                    List<String> t = new ArrayList<>();
                    t.add(n.headline());
                    t.add(n.taxDescription());
                    t.add(n.fireImpact());
                    if (n.immediateDescriptions() != null) t.addAll(n.immediateDescriptions());
                    if (n.longTermDescriptions() != null) t.addAll(n.longTermDescriptions());
                    if (n.checklist() != null) t.addAll(n.checklist());
                    return t;
                },
                (res, n) -> {
                    if (notBlank(n.headline())) res.put("headline", n.headline());
                    if (notBlank(n.taxDescription())) ((ObjectNode) res.get("taxImpact")).put("description", n.taxDescription());
                    if (notBlank(n.fireImpact())) res.put("fireImpact", n.fireImpact());
                    replace((ArrayNode) res.get("immediateActions"), n.immediateDescriptions());
                    replace((ArrayNode) res.get("longTermAllocation"), n.longTermDescriptions());
                    if (n.checklist() != null && n.checklist().size() == 4) {
                        ArrayNode a = res.putArray("checklist");
                        n.checklist().forEach(a::add);
                    }
                });

        return new Prepared(r, c.trace(), QUERIES.getOrDefault(c.eventType(), c.eventLabel()), rules.defaultTaxYear(), task,
                c.eventLabel() + ": tax " + Money.inr(c.taxLiability()) + ", health " + c.healthBefore() + "→" + c.healthAfter(), null);
    }

    private static void items(ArrayNode arr, List<Item> items) {
        for (var i : items) arr.addObject().put("title", i.title()).put("amount", Money.inr(i.amount())).put("description", i.facts());
    }

    private static void replace(ArrayNode arr, List<String> descriptions) {
        if (descriptions == null || descriptions.size() != arr.size()) return;
        for (int i = 0; i < arr.size(); i++) {
            if (notBlank(descriptions.get(i))) ((ObjectNode) arr.get(i)).put("description", descriptions.get(i));
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
