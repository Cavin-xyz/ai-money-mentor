package ai.money.mentor.backend.engine;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Annualised money-weighted return from dated cash flows (Newton's method, bisection fallback). */
public final class Xirr {

    public record Flow(LocalDate date, double amount) {
    }

    private Xirr() {
    }

    /** Returns the rate in percent, or null if it cannot be solved (e.g. no outflows). */
    public static Double of(List<Flow> flows) {
        if (flows.size() < 2) return null;
        boolean in = flows.stream().anyMatch(f -> f.amount() > 0), out = flows.stream().anyMatch(f -> f.amount() < 0);
        if (!in || !out) return null;
        LocalDate t0 = flows.stream().map(Flow::date).min(LocalDate::compareTo).orElseThrow();

        double rate = 0.1;
        for (int i = 0; i < 100; i++) {
            double f = npv(flows, t0, rate), df = dnpv(flows, t0, rate);
            if (Math.abs(df) < 1e-12) break;
            double next = rate - f / df;
            if (next <= -0.9999) next = (rate - 0.9999) / 2;
            if (Math.abs(next - rate) < 1e-9) return next * 100;
            rate = next;
        }
        double lo = -0.99, hi = 10;
        if (npv(flows, t0, lo) * npv(flows, t0, hi) > 0) return null;
        for (int i = 0; i < 200; i++) {
            double mid = (lo + hi) / 2;
            if (npv(flows, t0, lo) * npv(flows, t0, mid) <= 0) hi = mid; else lo = mid;
        }
        return (lo + hi) / 2 * 100;
    }

    private static double npv(List<Flow> flows, LocalDate t0, double r) {
        double s = 0;
        for (var f : flows) s += f.amount() / Math.pow(1 + r, ChronoUnit.DAYS.between(t0, f.date()) / 365.0);
        return s;
    }

    private static double dnpv(List<Flow> flows, LocalDate t0, double r) {
        double s = 0;
        for (var f : flows) {
            double t = ChronoUnit.DAYS.between(t0, f.date()) / 365.0;
            s -= t * f.amount() / Math.pow(1 + r, t + 1);
        }
        return s;
    }
}
