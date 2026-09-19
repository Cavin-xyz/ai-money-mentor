package ai.money.mentor.backend.modules;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.Money;
import ai.money.mentor.backend.engine.Inputs;
import ai.money.mentor.backend.engine.PortfolioEngine;
import ai.money.mentor.backend.engine.PortfolioEngine.Holding;
import ai.money.mentor.backend.engine.Xirr;
import ai.money.mentor.backend.memory.UserContext;
import ai.money.mentor.backend.orchestrator.ModuleAdvisor;
import ai.money.mentor.backend.rules.RulesRepository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class PortfolioAdvisor implements ModuleAdvisor {

    public record PortfolioNarrative(
            @JsonPropertyDescription("2 sentences summarising the portfolio's biggest issue and strength") String summary,
            @JsonPropertyDescription("One per rebalancing action, same order; 1 sentence each") List<String> actionReasons) {
    }

    private final PortfolioEngine engine;
    private final RulesRepository rules;
    private final JsonMapper json;

    public PortfolioAdvisor(PortfolioEngine engine, RulesRepository rules, JsonMapper json) {
        this.engine = engine;
        this.rules = rules;
        this.json = json;
    }

    @Override
    public String module() {
        return "portfolio";
    }

    @Override
    public String label() {
        return "Portfolio X-Ray";
    }

    @Override
    public Prepared prepare(Map<String, Object> request, UserContext user) {
        List<Holding> holdings = new ArrayList<>();
        for (var h : Inputs.list(request, "holdings")) {
            List<Xirr.Flow> flows = new ArrayList<>();
            for (var f : Inputs.list(h, "flows")) {
                try {
                    flows.add(new Xirr.Flow(LocalDate.parse(Inputs.str(f, "date", "")), Inputs.num(f, "amount")));
                } catch (Exception ignored) {
                    // skip malformed rows
                }
            }
            double value = Inputs.num(h, "value");
            if (value > 0) holdings.add(new Holding(Inputs.str(h, "name", "Fund"), value, Inputs.str(h, "amfi", null), flows));
        }
        double target = Inputs.num(request, "targetEquityPct", switch (user.investmentStyle()) {
            case "conservative" -> 40;
            case "aggressive" -> 80;
            default -> 60;
        });
        var c = engine.calculate(holdings, target);

        ObjectNode r = json.createObjectNode();
        r.put("portfolioValue", Money.compact(c.totalValue()));
        r.put("totalFunds", String.valueOf(c.fundCount()));
        r.put("estimatedXIRR", c.xirrPct() == null ? "n/a" : Money.pct(c.xirrPct(), 1));
        r.put("xirrNote", c.xirrNote());
        r.put("expenseDrag", Money.inr(c.expenseDrag()) + "/yr");
        r.put("navDate", c.navDate());
        r.put("source", Inputs.str(request, "source", "manual"));
        ArrayNode alloc = r.putArray("allocation");
        c.allocation().forEach(s -> alloc.addObject().put("category", s.category()).put("percentage", Money.pct(s.pct(), 0)).put("value", Money.compact(s.value())));
        r.set("assetMix", json.valueToTree(c.assetMix()));
        ArrayNode funds = r.putArray("funds");
        c.funds().forEach(f -> funds.addObject().put("name", f.name()).put("matchedName", f.matchedName()).put("category", f.category())
                .put("plan", f.direct() ? "Direct" : "Regular").put("currentValue", Money.compact(f.value()))
                .put("expenseRatio", Money.pct(f.terPct(), 2)).put("rating", f.rating()).put("remark", f.remark()));
        ArrayNode ov = r.putArray("overlap");
        c.overlap().forEach(o -> ov.addObject().put("stock", o.label()).put("funds", o.funds() + " funds")
                .put("exposure", Money.pct(o.exposurePct(), 0)).put("risk", o.risk()).put("detail", o.detail()));
        ObjectNode bm = r.putObject("benchmarkComparison");
        bm.put("portfolioReturn", c.xirrPct() == null ? "n/a" : Money.pct(c.xirrPct(), 1));
        bm.put("nifty50Return", c.benchmarkPct() == null ? "pending" : Money.pct(c.benchmarkPct(), 1));
        if (c.xirrPct() != null && c.benchmarkPct() != null) {
            double alpha = c.xirrPct() - c.benchmarkPct();
            bm.put("alpha", (alpha >= 0 ? "+" : "") + Money.pct(alpha, 1));
            bm.put("verdict", (alpha >= 0 ? "Ahead of " : "Behind ") + c.benchmarkName() + " (5-yr CAGR as of " + c.benchmarkAsOf() + ")");
        } else {
            bm.put("alpha", "—");
            bm.put("verdict", c.xirrPct() == null ? "Upload a CAS statement to compare returns" : "Benchmark data not yet verified");
        }
        ArrayNode reb = r.putArray("rebalancing");
        c.rebalancing().forEach(a -> reb.addObject().put("action", a.action()).put("fund", a.target()).put("reason", a.reason())
                .put("priority", a.priority()).put("amount", Money.compact(a.amount())));
        r.put("annualSavings", Money.inr(c.regularExtraCost()));
        r.putObject("directVsRegular").put("extraPerYear", Money.inr(c.regularExtraCost())).put("tenYearCost", Money.inr(c.tenYearCost()));
        r.put("healthScore", c.healthScore() + "/100");
        r.put("targetEquityPct", Math.round(c.targetEquityPct()));
        r.put("equityDrift", Math.round(c.equityDrift()));
        r.put("summary", templateSummary(c));

        int n = c.rebalancing().size();
        StringBuilder brief = new StringBuilder();
        for (int i = 0; i < n; i++) {
            var a = c.rebalancing().get(i);
            brief.append(i + 1).append(". ").append(a.action()).append(' ').append(a.target()).append(": ").append(a.reason()).append('\n');
        }
        var task = new NarrativeTask<>(PortfolioNarrative.class, """
                MODULE: Portfolio X-Ray (mutual funds).
                Write summary: 2 sentences — the biggest issue and one strength.
                Write actionReasons: exactly %d, one per action below, same order, 1 sentence each, keep the figures:
                %s
                Never suggest a new named scheme or fund house; category-level only (e.g. "a Nifty 50 index fund").""".formatted(n, brief),
                x -> {
                    List<String> t = new ArrayList<>();
                    t.add(x.summary() != null ? x.summary() : "");
                    if (x.actionReasons() != null) t.addAll(x.actionReasons());
                    return t;
                },
                (res, x) -> {
                    if (x.summary() != null && !x.summary().isBlank()) res.put("summary", x.summary());
                    if (x.actionReasons() != null && x.actionReasons().size() == n && n > 0) {
                        var arr = res.get("rebalancing");
                        if (arr instanceof ArrayNode) {
                            ArrayNode rebArray = (ArrayNode) arr;
                            for (int i = 0; i < n; i++) {
                                if (i < rebArray.size() && rebArray.get(i) instanceof ObjectNode) {
                                    ((ObjectNode) rebArray.get(i)).put("reason", x.actionReasons().get(i));
                                }
                            }
                        }
                    }
                });

        return new Prepared(r, c.trace(),
                "mutual fund categorisation SEBI direct plan regular plan expense ratio TER risk-o-meter capital gains 112A",
                rules.defaultTaxYear(), task,
                c.fundCount() + " funds, " + Money.compact(c.totalValue()) + ", score " + c.healthScore() + "/100", null);
    }

    private static String templateSummary(PortfolioEngine.PortfolioCalc c) {
        String issue = c.regularExtraCost() > 0
                ? "Regular plans cost you about " + Money.inr(c.regularExtraCost()) + " a year more than Direct plans."
                : !c.overlap().isEmpty() ? c.overlap().size() + " overlapping fund categories add little diversification."
                : "Costs and overlap look under control.";
        String strength = Math.abs(c.equityDrift()) <= 10 ? " Your equity mix is close to your target."
                : " Equity is " + Math.round(Math.abs(c.equityDrift())) + " points " + (c.equityDrift() > 0 ? "above" : "below") + " your target.";
        return issue + strength;
    }
}
