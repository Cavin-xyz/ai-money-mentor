package ai.money.mentor.backend.safety;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.engine.AmfiService;
import ai.money.mentor.backend.rag.Citation;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;

class SafetyLayerTest {

    @TempDir
    Path dataDir;

    private SafetyLayer safety;
    private CalcTrace trace;

    @BeforeEach
    void setUp() throws Exception {
        // Tiny AMFI file so the product check knows one fund house, without any network access
        Path amfi = Files.createDirectories(dataDir.resolve("amfi")).resolve("NAVAll.txt");
        Files.writeString(amfi, """
                Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
                Open Ended Schemes(Equity Scheme - Large Cap Fund)
                Axis Mutual Fund
                120465;INF846K01DP8;-;Axis Large Cap Fund;Direct Plan;Growth Option;60.12;18-Sep-2026
                """);
        safety = new SafetyLayer(new RulesRepository(JsonMapper.builder().build(), "2026-27"), new AmfiService(dataDir.toString()));
        trace = new CalcTrace();
        trace.fact("fire.requiredSip", 74_500);
        trace.fact("fire.number", 69_933_880);
    }

    private SafetyLayer.Verdict check(String text, List<Citation> cites, String winner) {
        return safety.check(List.of(text), trace, Map.of(), cites, winner, Set.of(), "2026-27");
    }

    private static boolean passed(SafetyLayer.Verdict v, String key) {
        return v.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow().passed();
    }

    @Test
    void acceptsFiguresFromTheEngineInAnyIndianFormat() {
        var v = check("Invest ₹74,500 a month to reach ₹6.99 Cr.", List.of(), null);
        assertTrue(v.numbersOk(), v.unverified().toString());
    }

    @Test
    void rejectsAnInventedAmount() {
        var v = check("You should invest ₹99,999 every month.", List.of(), null);
        assertFalse(v.numbersOk());
        assertEquals(List.of("₹99,999"), v.unverified());
    }

    @Test
    void readsIndianLanguageUnits() {
        trace.fact("ins.lifeGap", 9_400_000);
        assertTrue(check("जीवन बीमा में ₹94 लाख की कमी है और लक्ष्य ₹6.99 करोड़ है।", List.of(), null).numbersOk());
        assertTrue(check("జీవిత బీమాలో ₹94 లక్షల లోటు ఉంది.", List.of(), null).numbersOk());
        // "₹1,95 करोड़" is a model formatting slip (19.5 billion) — must be caught
        assertFalse(check("अनुमानित कोष ₹1,95 करोड़ है।", List.of(), null).numbersOk());
    }

    @Test
    void acceptsFiguresQuotedFromARetrievedOfficialPassage() {
        var cite = new Citation("S1", "SEBI", "Regular and Direct Mutual Fund Plans", null, null, "all", "https://investor.sebi.gov.in",
                "Suppose you invest ₹1,00,000 in a mutual fund…", 0.03);
        var v = check("For example, on ₹1,00,000 the difference adds up [S1].", List.of(cite), null);
        assertTrue(v.numbersOk(), v.unverified().toString());
    }

    @Test
    void stripsCitationsThatPointAtNothing() {
        var v = check("Deductions are not allowed [S3].", List.of(), null);
        assertFalse(passed(v, "source"));
        assertEquals("Deductions are not allowed .", v.cleanedTexts().get(0));
    }

    @Test
    void flagsANamedFundHouse() {
        var v = check("Buy the Axis Large Cap Fund for growth.", List.of(), null);
        assertFalse(passed(v, "products"));
    }

    @Test
    void flagsTextThatContradictsTheRegimeVerdict() {
        assertFalse(passed(check("The old regime is better for you.", List.of(), "new"), "consistency"));
        assertTrue(passed(check("The old regime is not better for you.", List.of(), "new"), "consistency"));
    }
}
