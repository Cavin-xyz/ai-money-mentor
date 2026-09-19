package ai.money.mentor.backend.engine;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Deterministic scam checks: SEBI's "@valid" UPI format for registered intermediaries, a
 * red-flag phrase library and an optional RBI digital-lending-app snapshot. The risk level is
 * decided here; the LLM only explains the flags.
 */
@Component
public class ScamEngine {

    private static final Logger log = LoggerFactory.getLogger(ScamEngine.class);

    private record Rule(String category, String label, int weight, Pattern pattern) {
    }

    private static final List<Rule> RULES = List.of(
            rule("returns", "Guaranteed or unrealistic returns", 3,
                    "guarantee[d]?\\s+(returns?|profit|income)|assured\\s+returns?|double\\s+your\\s+money|risk[- ]free\\s+(returns?|profit)|\\d{1,3}\\s?%\\s*(daily|weekly|per\\s+day|per\\s+week|monthly)\\s+(returns?|profit)"),
            rule("urgency", "Pressure to act immediately", 1,
                    "urgent(ly)?|immediately|within\\s+\\d+\\s+(hours?|minutes?)|last\\s+chance|act\\s+now|today\\s+only|limited\\s+slots?"),
            rule("secrecy", "Asks you to keep it secret", 2, "don'?t\\s+tell|do\\s+not\\s+tell|keep\\s+(this|it)\\s+(confidential|secret)|do\\s+not\\s+share\\s+with\\s+(anyone|family)"),
            rule("credentials", "Asks for OTP, PIN or passwords", 3, "\\botp\\b|\\bpin\\b|\\bcvv\\b|password|share\\s+(the\\s+)?code"),
            rule("kyc", "Fake KYC / account-block threat", 2, "kyc\\s+(update|expir\\w*|pending|suspend\\w*)|account\\s+(will\\s+be\\s+)?(blocked|suspended|frozen)|pan\\s+(blocked|deactivat\\w*)"),
            // Weighted to reach HIGH on its own: agencies never "arrest" people over a call
            rule("arrest", "\"Digital arrest\" or official intimidation", 6, "digital\\s+arrest|arrest\\s+warrant|\\bcbi\\b|narcotics|customs\\s+(department|officer)|money\\s+laundering\\s+case|police\\s+case"),
            rule("task", "Paid-task / part-time job lure", 2, "like\\s+(youtube\\s+)?videos|rate\\s+(hotels?|products?)|prepaid\\s+task|part[- ]time\\s+job.{0,30}?(earn|daily)"),
            rule("remote", "Asks you to install a remote-access app", 3, "anydesk|teamviewer|quick\\s?support|screen\\s+shar\\w*"),
            rule("tips", "Stock 'tips' from an unregistered source", 2, "sure[- ]shot|insider\\s+(tip|info)|multibagger\\s+tips?|(telegram|whatsapp)\\s+(group|channel)"),
            rule("crypto", "Crypto / foreign-exchange investment pitch", 2, "\\busdt\\b|crypto(currency)?\\s+(investment|trading|scheme)|forex\\s+(trading|investment)|bitcoin\\s+(doubling|investment)"),
            rule("upfront", "Upfront fee before a loan or payout", 2, "processing\\s+fee|advance\\s+fee|pay\\s+(a\\s+)?(small\\s+)?(fee|charge)\\s+(first|to\\s+(release|unlock|process))|registration\\s+charges?"));

    private static final Pattern UPI = Pattern.compile("([a-zA-Z0-9._-]{2,256})@([a-zA-Z][a-zA-Z0-9]{1,64})");
    private static final Pattern CLAIMS_MARKET = Pattern.compile("(?i)broker|demat|trading\\s+account|mutual\\s+fund|sebi[- ]registered|stock\\s+market|\\bipo\\b|investment\\s+advis");

    public record Flag(String category, String label, int weight, String phrase, int start, int end) {
    }

    public record Check(String key, String label, String status, String detail) {
    }

    public record ScamCalc(String riskLevel, int riskScore, List<Flag> flags, List<Check> checks, String message,
            String upiId, String appName, List<Map<String, String>> helplines, CalcTrace trace) {
    }

    private final RulesRepository rules;
    private final JsonMapper json;
    private final Path dlaFile;

    public ScamEngine(RulesRepository rules, JsonMapper json, @Value("${mentor.data-dir}") String dataDir) {
        this.rules = rules;
        this.json = json;
        this.dlaFile = Path.of(dataDir, "rbi", "dla.json");
    }

    private static Rule rule(String c, String l, int w, String regex) {
        return new Rule(c, l, w, Pattern.compile("(?i)" + regex));
    }

    public ScamCalc calculate(Map<String, Object> req) {
        String message = Inputs.str(req, "message", "");
        String upiId = Inputs.str(req, "upiId", "");
        String appName = Inputs.str(req, "appName", "");
        if (message.isBlank() && upiId.isBlank() && appName.isBlank()) {
            throw new IllegalArgumentException("Paste a message, or enter a UPI ID or app name");
        }
        var t = new CalcTrace().group("Red-flag scan");
        List<Flag> flags = new ArrayList<>();
        for (var r : RULES) {
            Matcher m = r.pattern().matcher(message);
            boolean first = true;
            while (m.find()) {
                flags.add(new Flag(r.category(), r.label(), first ? r.weight() : 0, m.group(), m.start(), m.end()));
                first = false;
            }
        }
        List<Check> checks = new ArrayList<>();

        // UPI handle check (from the field, or the first handle in the message)
        String upi = upiId;
        if (upi.isBlank()) {
            Matcher um = UPI.matcher(message);
            if (um.find()) upi = um.group();
        }
        JsonNode scam = rules.block("scam");
        String validPrefix = scam.path("sebiUpiDomainPrefix").asString("valid");
        List<String> tags = new ArrayList<>();
        scam.path("sebiUpiCategoryTags").forEach(n -> tags.add(n.asString()));
        int extra = 0;
        if (!upi.isBlank()) {
            Matcher um = UPI.matcher(upi.trim());
            if (!um.matches()) {
                checks.add(new Check("upi", "UPI ID format", "warn", "'" + upi + "' is not a valid UPI ID"));
            } else {
                String handle = um.group(1).toLowerCase(Locale.ROOT), psp = um.group(2).toLowerCase(Locale.ROOT);
                boolean sebiFormat = psp.startsWith(validPrefix) && tags.stream().anyMatch(tag -> handle.endsWith("." + tag));
                boolean claimsMarket = CLAIMS_MARKET.matcher(message).find();
                if (sebiFormat) {
                    checks.add(new Check("upi", "SEBI @valid UPI format", "pass",
                            upi + " follows the format SEBI requires for registered brokers and mutual funds — still confirm it on SEBI Check"));
                } else if (claimsMarket) {
                    extra += 3;
                    checks.add(new Check("upi", "SEBI @valid UPI format", "fail",
                            "The message talks about investing, but " + upi + " is not an '@valid' handle used by SEBI-registered intermediaries"));
                } else {
                    checks.add(new Check("upi", "SEBI @valid UPI format", "info",
                            upi + " is an ordinary UPI ID — fine for people, but registered brokers and mutual funds collect money only via '@valid' handles"));
                }
            }
        }

        // RBI digital lending app directory (snapshot provided by the team)
        if (!appName.isBlank()) {
            List<String> apps = dlaApps();
            if (apps.isEmpty()) {
                checks.add(new Check("dla", "RBI lending-app directory", "info", "The RBI directory snapshot isn't loaded on this device yet — search the app on rbi.org.in"));
            } else {
                String q = appName.toLowerCase(Locale.ROOT).trim();
                boolean listed = apps.stream().anyMatch(a -> a.toLowerCase(Locale.ROOT).contains(q) || q.contains(a.toLowerCase(Locale.ROOT)));
                if (!listed) extra += 3;
                checks.add(new Check("dla", "RBI lending-app directory", listed ? "pass" : "fail", listed
                        ? appName + " appears in the RBI directory snapshot. Being listed is not an endorsement — RBI publishes what lenders report."
                        : appName + " was not found in the RBI directory snapshot — treat it as unregulated until proven otherwise"));
            }
        }

        int score = flags.stream().mapToInt(Flag::weight).sum() + extra;
        String level = score >= 6 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
        for (var f : flags) if (f.weight() > 0) t.step(f.label(), "matched \"" + f.phrase() + "\"", "+" + f.weight());
        if (extra > 0) t.step("Registration checks", "UPI / RBI directory", "+" + extra);
        t.group("Verdict");
        t.step("Risk score", "sum of red-flag weights (≥6 high, ≥3 medium)", score + " → " + level);
        t.fact("scam.score", score);
        t.fact("helpline", 1930);

        List<Map<String, String>> help = new ArrayList<>();
        scam.path("helplines").forEach(h -> help.add(Map.of("label", h.path("label").asString(), "url", h.path("url").asString())));
        return new ScamCalc(level, score, flags, checks, message, upi, appName, help, t);
    }

    private List<String> dlaApps() {
        if (!Files.exists(dlaFile)) return List.of();
        try {
            List<String> out = new ArrayList<>();
            for (JsonNode n : json.readTree(Files.readString(dlaFile))) {
                String name = n.isString() ? n.asString() : n.path("appName").asString("");
                if (!name.isBlank()) out.add(name);
            }
            return out;
        } catch (IOException | RuntimeException e) {
            log.warn("Could not read RBI DLA snapshot: {}", e.getMessage());
            return List.of();
        }
    }
}
