package ai.money.mentor.backend.engine;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.JsonNode;

/**
 * Portfolio X-Ray maths. Holdings come from a parsed CAS (with transactions → real XIRR) or
 * manual rows (value only). Funds are matched to AMFI's scheme list for category and plan.
 * Rebalancing stays at category / asset-class level — never "buy scheme X".
 */
@Component
public class PortfolioEngine {

    private final AmfiService amfi;
    private final RulesRepository rules;

    public PortfolioEngine(AmfiService amfi, RulesRepository rules) {
        this.amfi = amfi;
        this.rules = rules;
    }

    public record Holding(String name, double value, String amfiCode, List<Xirr.Flow> flows) {
    }

    public record Fund(String name, String matchedName, String schemeCode, String category, String assetClass,
            boolean direct, double value, double weightPct, double terPct, double annualCost, double extraCostVsDirect,
            String rating, String remark) {
    }

    public record Slice(String category, double value, double pct) {
    }

    public record Overlap(String label, int funds, double exposurePct, String risk, String detail) {
    }

    public record Action(String action, String target, String reason, String priority, double amount) {
    }

    public record PortfolioCalc(double totalValue, int fundCount, String navDate, List<Fund> funds,
            List<Slice> allocation, Map<String, Double> assetMix, List<Overlap> overlap, double expenseDrag,
            double regularExtraCost, double tenYearCost, Double xirrPct, String xirrNote, double targetEquityPct,
            double equityDrift, List<Action> rebalancing, int healthScore, Double benchmarkPct, String benchmarkName,
            String benchmarkAsOf, CalcTrace trace) {
    }

    public PortfolioCalc calculate(List<Holding> holdings, double targetEquityPct) {
        var t = new CalcTrace();
        if (holdings.isEmpty()) throw new IllegalArgumentException("Add at least one fund with its current value");
        double total = holdings.stream().mapToDouble(Holding::value).sum();
        if (total <= 0) throw new IllegalArgumentException("Fund values must be greater than zero");
        JsonNode ter = rules.portfolioNode("typicalTerPct");

        // ── Match and cost each fund ───────────────────────────────────
        t.group("Funds (matched to AMFI list, NAV date " + amfi.navDate() + ")");
        List<Fund> funds = new ArrayList<>();
        for (var h : holdings) {
            var s = amfi.match(h.name(), h.amfiCode());
            String cat = s != null ? s.category() : AmfiService.normalise("", h.name());
            String asset = s != null ? s.assetClass() : AmfiService.assetClass(cat);
            boolean direct = s != null ? s.direct() : h.name().toLowerCase().contains("direct");
            JsonNode c = ter.has(cat) ? ter.path(cat) : ter.path("Other");
            double terPct = c.path(direct ? "direct" : "regular").asDouble();
            double directTer = c.path("direct").asDouble();
            double cost = h.value() * terPct / 100;
            double extra = direct ? 0 : h.value() * (terPct - directTer) / 100;
            funds.add(new Fund(h.name(), s != null ? s.name() + " · " + s.plan() : null, s != null ? s.code() : null,
                    cat, asset, direct, h.value(), h.value() / total * 100, terPct, cost, extra, "", ""));
            t.step(h.name(), cat + " · " + (direct ? "Direct" : "Regular") + " · TER ≈ " + Money.pct(terPct, 2),
                    Money.inr(h.value()) + " (" + Money.pct(h.value() / total * 100, 0) + ")");
        }
        t.assume(rules.portfolioNode("typicalTerNote").asString());

        // ── Allocation ─────────────────────────────────────────────────
        Map<String, Double> byCat = funds.stream().collect(Collectors.groupingBy(Fund::category, LinkedHashMap::new, Collectors.summingDouble(Fund::value)));
        List<Slice> allocation = byCat.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(e -> new Slice(e.getKey(), e.getValue(), e.getValue() / total * 100)).toList();
        Map<String, Double> assetMix = new LinkedHashMap<>();
        for (String a : List.of("Equity", "Debt", "Hybrid", "Gold", "International", "Other")) {
            double v = funds.stream().filter(f -> f.assetClass().equals(a)).mapToDouble(Fund::value).sum();
            if (v > 0) assetMix.put(a, v / total * 100);
        }
        double equityPct = assetMix.getOrDefault("Equity", 0.0) + assetMix.getOrDefault("International", 0.0)
                + assetMix.getOrDefault("Hybrid", 0.0) * 0.6;
        t.group("Allocation");
        t.step("Portfolio value", "sum of holdings", Money.inr(total));
        assetMix.forEach((k, v) -> t.step(k, "share of value", Money.pct(v, 1)));
        t.step("Effective equity", "equity + international + 60% of hybrid", Money.pct(equityPct, 0));
        t.step("Target equity", "from your risk profile", Money.pct(targetEquityPct, 0));
        double drift = equityPct - targetEquityPct;
        t.fact("pf.total", total);
        t.fact("pf.equityPct", equityPct);
        t.fact("pf.drift", drift);
        allocation.forEach(sl -> t.fact("alloc." + sl.category(), sl.value()));

        // ── Overlap (category level; stock-level needs a holdings snapshot) ─
        List<Overlap> overlap = new ArrayList<>();
        byCat.forEach((cat, v) -> {
            long n = funds.stream().filter(f -> f.category().equals(cat)).count();
            boolean equityCat = AmfiService.assetClass(cat).equals("Equity") && !cat.equals("Index");
            if (n >= 2 && equityCat) {
                String risk = n >= 3 ? "HIGH" : "MEDIUM";
                overlap.add(new Overlap(cat + " funds", (int) n, v / total * 100, risk,
                        n + " funds in the same category usually hold many of the same stocks"));
            }
        });
        double largeish = byCat.entrySet().stream().filter(e -> List.of("Large Cap", "Index", "Large & Mid Cap", "Flexi Cap", "Focused").contains(e.getKey()))
                .mapToDouble(Map.Entry::getValue).sum();
        long largeishFunds = funds.stream().filter(f -> List.of("Large Cap", "Index", "Large & Mid Cap", "Flexi Cap", "Focused").contains(f.category())).count();
        if (largeishFunds >= 3 && overlap.stream().noneMatch(o -> o.label().startsWith("Large Cap"))) {
            overlap.add(new Overlap("Large-cap heavy funds", (int) largeishFunds, largeish / total * 100, "MEDIUM",
                    "Large-cap, index, flexi-cap and focused funds all lean on the same top-50 stocks"));
        }
        t.group("Overlap");
        t.step("Overlapping categories", "2+ active equity funds in one category", overlap.isEmpty() ? "none" : overlap.size() + " found");
        t.assume("Overlap is estimated at category level; stock-level overlap needs a monthly holdings snapshot");

        // ── Costs ──────────────────────────────────────────────────────
        double drag = funds.stream().mapToDouble(Fund::annualCost).sum();
        double extra = funds.stream().mapToDouble(Fund::extraCostVsDirect).sum();
        double r = rules.assumption("equityReturnPct");
        double regularValue = funds.stream().filter(f -> !f.direct()).mapToDouble(Fund::value).sum();
        double avgRegTer = regularValue > 0 ? funds.stream().filter(f -> !f.direct()).mapToDouble(f -> f.value() * f.terPct()).sum() / regularValue : 0;
        double avgDirTer = regularValue > 0 ? funds.stream().filter(f -> !f.direct()).mapToDouble(f -> f.value() * (f.terPct() - f.extraCostVsDirect() / f.value() * 100)).sum() / regularValue : 0;
        double tenYear = regularValue * (Math.pow(1 + (r - avgDirTer) / 100, 10) - Math.pow(1 + (r - avgRegTer) / 100, 10));
        t.group("Costs");
        t.step("Annual expense drag", "Σ value × TER", Money.inr(drag) + "/yr");
        t.step("Extra paid for Regular plans", "Σ value × (regular TER − direct TER)", Money.inr(extra) + "/yr");
        t.step("10-year cost of staying Regular", Money.inr(regularValue) + " compounded at " + Money.pct(r) + " minus each TER", Money.inr(tenYear));
        t.fact("pf.drag", drag);
        t.fact("pf.extra", extra);
        t.fact("pf.tenYear", tenYear);
        t.fact("pf.regularValue", regularValue);

        // ── XIRR from real transactions only ───────────────────────────
        List<Xirr.Flow> flows = new ArrayList<>();
        for (var h : holdings) if (h.flows() != null) flows.addAll(h.flows());
        Double xirr = null;
        String xirrNote;
        if (flows.isEmpty()) {
            xirrNote = "Needs transaction history (upload your CAS statement)";
        } else {
            flows.add(new Xirr.Flow(LocalDate.now(), total));
            xirr = Xirr.of(flows);
            xirrNote = xirr == null ? "Could not solve XIRR from these transactions" : "Money-weighted return from " + (flows.size() - 1) + " transactions";
        }
        t.group("Returns");
        t.step("XIRR", xirrNote, xirr == null ? "n/a" : Money.pct(xirr, 1));
        if (xirr != null) t.fact("pf.xirr", xirr);

        JsonNode bm = rules.portfolioNode("benchmark");
        Double bmPct = bm.path("cagr5yPct").isNumber() ? bm.path("cagr5yPct").asDouble() : null;
        String bmAsOf = bm.path("asOf").isNull() ? null : bm.path("asOf").asString(null);
        if (bmPct != null) t.fact("pf.benchmark", bmPct);

        // ── Rebalancing (category / asset-class level) ─────────────────
        List<Action> actions = new ArrayList<>();
        for (var f : funds) {
            if (!f.direct() && f.extraCostVsDirect() > 0) {
                actions.add(new Action("SWITCH", f.name() + " → Direct plan",
                        "Same fund, lower TER: saves ≈" + Money.inr(f.extraCostVsDirect()) + "/yr. Check exit load and capital-gains tax before switching.",
                        f.extraCostVsDirect() > 5000 ? "Critical" : "High", f.value()));
            }
        }
        for (var o : overlap) {
            String cat = o.label().replace(" funds", "");
            if (byCat.containsKey(cat) && o.funds() >= 2) { // real same-category overlap, not the large-cap-tilt note
                double smaller = funds.stream().filter(f -> f.category().equals(cat)).sorted(Comparator.comparingDouble(Fund::value).reversed())
                        .skip(1).mapToDouble(Fund::value).sum();
                actions.add(new Action("CONSOLIDATE", o.funds() + " " + cat + " funds → 1",
                        "Keep the lowest-cost fund in the category; merging reduces overlap without changing your risk.", "High", smaller));
            }
        }
        if (Math.abs(drift) > 10) {
            boolean over = drift > 0;
            actions.add(new Action(over ? "REDUCE" : "ADD", over ? "Equity allocation" : "Equity (index funds)",
                    "Equity is " + Money.pct(equityPct, 0) + " vs your " + Money.pct(targetEquityPct, 0) + " target"
                            + (over ? " — move the excess to short-duration debt or PPF." : " — add via a Nifty 50 index fund SIP."),
                    "Medium", Math.abs(drift) / 100 * total));
        }
        funds.stream().filter(f -> f.weightPct() > 35).forEach(f -> actions.add(new Action("TRIM", f.name(),
                "One fund is " + Money.pct(f.weightPct(), 0) + " of the portfolio; keep single funds under 35%.", "Medium",
                (f.weightPct() - 35) / 100 * total)));
        actions.forEach(a -> t.fact("action." + a.target(), a.amount()));

        // ── Ratings and score ──────────────────────────────────────────
        List<Fund> rated = new ArrayList<>();
        for (var f : funds) {
            boolean overlapped = overlap.stream().anyMatch(o -> o.label().equals(f.category() + " funds"));
            String rating = !f.direct() && (overlapped || f.category().equals("Sectoral/Thematic")) ? "Poor"
                    : !f.direct() || overlapped ? "Average" : "Good";
            String remark = !f.direct() ? "Regular plan: ≈" + Money.inr(f.extraCostVsDirect()) + "/yr extra"
                    : overlapped ? "Overlaps another " + f.category() + " fund" : "Direct plan, TER ≈ " + Money.pct(f.terPct(), 2);
            rated.add(new Fund(f.name(), f.matchedName(), f.schemeCode(), f.category(), f.assetClass(), f.direct(), f.value(),
                    f.weightPct(), f.terPct(), f.annualCost(), f.extraCostVsDirect(), rating, remark));
        }
        double regularShare = regularValue / total;
        int score = (int) Math.round(Finance.clamp(100 - regularShare * 30 - overlap.size() * 8 - Math.abs(drift) * 0.5
                - (funds.stream().anyMatch(f -> f.weightPct() > 35) ? 10 : 0), 0, 100));
        t.group("Portfolio health");
        t.step("Score", "100 − 30×regular share − 8×overlaps − 0.5×|equity drift| − 10 if a fund > 35%", score + "/100");
        t.fact("pf.score", score);

        return new PortfolioCalc(total, funds.size(), amfi.navDate(), rated, allocation, assetMix, overlap, drag, extra,
                tenYear, xirr, xirrNote, targetEquityPct, drift, actions, score, bmPct, bm.path("name").asString(), bmAsOf, t);
    }
}
