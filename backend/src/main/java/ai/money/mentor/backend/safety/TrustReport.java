package ai.money.mentor.backend.safety;

import java.util.List;

/** Shown in the UI as the trust badge: which checks passed, what was flagged, how grounded the answer is. */
public record TrustReport(List<Check> checks, List<String> warnings, int groundedScore, String explanationSource,
        String disclaimer) {

    public record Check(String key, String label, boolean passed, String detail) {
    }

    public static final String DISCLAIMER = "Educational guidance generated on this device, not investment, tax or legal advice. "
            + "Numbers come from a deterministic calculator; verify important decisions with a SEBI-registered adviser or a Chartered Accountant.";
}
