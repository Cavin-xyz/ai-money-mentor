package ai.money.mentor.backend.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;

/**
 * Hand-worked cases for Tax Year 2026-27. T2: append rows verified against the
 * e-filing portal's calculator (incometax.gov.in) — the engine must match to the rupee.
 */
class TaxEngineTest {

    private final TaxEngine engine;

    TaxEngineTest() throws Exception {
        engine = new TaxEngine(new RulesRepository(JsonMapper.builder().build(), "2026-27"));
    }

    @ParameterizedTest(name = "new regime, gross {0} → tax {1}")
    @CsvSource({
            // gross salary, expected total tax
            "700000, 0",          // taxable 6.25L, fully rebated
            "1275000, 0",         // taxable exactly 12L → ₹60,000 rebate wipes it out
            "1300000, 26000",     // taxable 12.25L: marginal relief caps tax at ₹25,000 + 4% cess
            "2000000, 192400",    // taxable 19.25L: 1,85,000 + cess 7,400
            "6000000, 1552980",   // taxable 59.25L: 10% surcharge, no marginal relief needed
    })
    void newRegime(double gross, double expected) {
        var r = engine.compare(TaxInput.salary(gross), "2026-27");
        assertEquals(expected, r.newRegime().totalTax(), 0.5);
    }

    @Test
    void oldRegimeWithDeductions() {
        // taxable = 10L − 50K std − 1.5L (Sec 123) − 25K (80D) = 7.75L
        // tax = 12,500 + 55,000 = 67,500 + 4% cess = 70,200
        var in = TaxInput.salary(1_000_000).sec80C(150_000).sec80D(25_000);
        var r = engine.compare(in, "2026-27");
        assertEquals(775_000, r.oldRegime().taxableIncome(), 0.5);
        assertEquals(70_200, r.oldRegime().totalTax(), 0.5);
        assertEquals("new", r.winner());
        assertEquals(70_200, r.savings(), 0.5);
    }

    @Test
    void oldRegimeRebateBelowFiveLakh() {
        var r = engine.compare(TaxInput.salary(550_000), "2026-27");
        assertEquals(500_000, r.oldRegime().taxableIncome(), 0.5);
        assertEquals(0, r.oldRegime().totalTax(), 0.5);
    }

    @Test
    void deductionGapSavingsAreRecomputedNotEstimated() {
        // At 25L with no deductions, old-regime marginal rate is 30% + cess → 1.5L of Sec 123 saves 46,800
        var r = engine.compare(TaxInput.salary(2_500_000), "2026-27");
        var gap = r.gaps().stream().filter(g -> g.key().equals("sec80C")).findFirst().orElseThrow();
        assertEquals(150_000, gap.headroom(), 0.5);
        assertEquals(46_800, gap.oldRegimeSaving(), 10);
    }

    @Test
    void sameSlabsForBothTaxYears() {
        double a = engine.compare(TaxInput.salary(1_800_000), "2026-27").newRegime().totalTax();
        double b = engine.compare(TaxInput.salary(1_800_000), "2025-26").newRegime().totalTax();
        assertEquals(a, b, 0.5);
    }
}
