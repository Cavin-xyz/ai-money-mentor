package ai.money.mentor.backend.modules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.engine.ScamEngine;
import ai.money.mentor.backend.engine.ScamEngine.Flag;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class ScamShieldAdvisor implements ModuleAdvisor {

    public record FlagNote(@JsonPropertyDescription("The red-flag label exactly as given") String label,
            @JsonPropertyDescription("1-2 sentences on why this is a warning sign") String explanation) {
    }

    public record ScamNarrative(
            @JsonPropertyDescription("2 sentences: overall verdict and the single most important thing to do now") String verdict,
            @JsonPropertyDescription("One entry per red-flag label") List<FlagNote> flags) {
    }

    private final ScamEngine engine;
    private final RulesRepository rules;
    private final JsonMapper json;

    public ScamShieldAdvisor(ScamEngine engine, RulesRepository rules, JsonMapper json) {
        this.engine = engine;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "scam-shield";
    }

    @Override
    public String label() {
        return "Scam Shield";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        var c = engine.calculate(request);
        ObjectNode r = json.createObjectNode();
        r.put("riskLevel", c.riskLevel());
        r.put("riskScore", c.riskScore());
        r.put("message", c.message());
        r.put("upiId", c.upiId());
        r.put("appName", c.appName());
        r.set("flags", json.valueToTree(c.flags()));
        r.set("checks", json.valueToTree(c.checks()));
        r.set("helplines", json.valueToTree(c.helplines()));

        Map<String, String> categories = new LinkedHashMap<>();
        for (Flag f : c.flags()) categories.putIfAbsent(f.category(), f.label());
        ArrayNode cats = r.putArray("categories");
        categories.forEach((k, label) -> cats.addObject().put("category", k).put("label", label).put("explanation", template(k)));
        r.put("verdict", switch (c.riskLevel()) {
            case "HIGH" -> "This has several hallmarks of a scam. Don't pay, share OTPs or install anything; report it on 1930 or cybercrime.gov.in.";
            case "MEDIUM" -> "Some warning signs here. Verify the sender independently before paying or sharing any details.";
            default -> c.flags().isEmpty() && c.checks().isEmpty() ? "No red flags found in what you shared." : "No strong red flags, but verify registration before sending money.";
        });

        var task = new NarrativeTask<>(ScamNarrative.class, """
                MODULE: Scam Shield. The risk level (%s) was decided by rules — do not change it.
                RED-FLAG CATEGORIES (in order): %s
                Write verdict: 2 sentences — plain verdict and the single most important thing to do now.
                Write flags: one entry per red-flag label (copy the label exactly), explaining why it is a warning sign in India.
                Point to SEBI/RBI guidance only if it appears in SOURCES. Never tell the user to contact numbers from the message."""
                .formatted(c.riskLevel(), String.join("; ", categories.values())),
                x -> {
                    List<String> t = new ArrayList<>();
                    t.add(x.verdict());
                    if (x.flags() != null) x.flags().forEach(f -> t.add(f.explanation()));
                    return t;
                },
                (res, x) -> {
                    if (x.verdict() != null && !x.verdict().isBlank()) res.put("verdict", x.verdict());
                    if (x.flags() == null) return;
                    for (var node : (ArrayNode) res.get("categories")) {
                        String label = node.path("label").asString();
                        x.flags().stream()
                                .filter(f -> f.label() != null && f.explanation() != null && !f.explanation().isBlank()
                                        && f.label().trim().equalsIgnoreCase(label))
                                .findFirst()
                                .ifPresent(f -> ((ObjectNode) node).put("explanation", f.explanation()));
                    }
                });

        return new Prepared(r, c.trace(),
                "investor fraud unregistered investment adviser UPI valid SEBI registered intermediary digital lending app RBI cyber fraud",
                rules.defaultTaxYear(), task, "Scam check: " + c.riskLevel() + " risk (" + c.flags().size() + " flags)", null);
    }

    private static String template(String category) {
        return switch (category) {
            case "returns" -> "No legitimate investment can guarantee returns; promises like this are the most common sign of fraud.";
            case "urgency" -> "Scammers rush you so you don't stop to verify.";
            case "secrecy" -> "Being told to keep it secret stops friends or family from warning you.";
            case "credentials" -> "Banks, regulators and brokers never ask for your OTP, PIN or password.";
            case "kyc" -> "KYC updates are done through your bank's own app or branch, never through a link in a message.";
            case "arrest" -> "Police and agencies do not arrest people over video calls or ask for money to settle a case.";
            case "task" -> "Paid 'tasks' that later ask you to deposit money are a well-known scam pattern.";
            case "remote" -> "Remote-access apps let a stranger control your phone and your banking apps.";
            case "tips" -> "Only SEBI-registered investment advisers and research analysts may give paid stock recommendations.";
            case "crypto" -> "Offshore crypto and forex schemes are a frequent route for investment fraud.";
            case "upfront" -> "Genuine lenders deduct fees from the loan; asking for payment first is a red flag.";
            default -> "This pattern is common in fraud messages.";
        };
    }
}
