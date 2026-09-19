package ai.money.mentor.backend.rag;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Splits legal/FAQ text at section and question boundaries rather than fixed windows, so a
 * chunk rarely mixes two rules. Falls back to ~400-token windows with overlap.
 */
public final class SectionSplitter {

    private static final int MAX_CHARS = 1600;   // ≈ 400 tokens
    private static final int OVERLAP_CHARS = 200; // ≈ 50 tokens

    private static final Pattern HEADING = Pattern.compile(
            "^(?:#{1,4}\\s+.+"
                    + "|(?:Section|Sec\\.?|SECTION)\\s+\\d{1,3}[A-Z]{0,4}\\b.*"
                    + "|\\d{1,3}[A-Z]{0,3}\\.\\s+[A-Z][^.]{3,120}"
                    + "|(?:Q\\.?|Question)\\s*\\d+[.:)]?.*"
                    + "|\\d{1,3}[.)]\\s*(?:What|How|Can|Is|Are|Do|Does|Who|When|Which|Whether)\\b.*"
                    + "|[A-Z][A-Z &,\\-()]{8,80})$");

    private SectionSplitter() {
    }

    public record Chunk(String heading, String text) {
    }

    public static List<Chunk> split(String raw) {
        String text = raw.replace("\r", "").replaceAll("[ \\t\\u00A0]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        List<Chunk> out = new ArrayList<>();
        String heading = "";
        StringBuilder buf = new StringBuilder();
        for (String line : text.split("\\n")) {
            String l = line.strip();
            if (l.isEmpty()) {
                buf.append('\n');
                continue;
            }
            if (HEADING.matcher(l).matches() && buf.toString().strip().length() > 120) {
                flush(out, heading, buf.toString());
                buf.setLength(0);
                heading = l.replaceFirst("^#+\\s*", "");
            } else if (HEADING.matcher(l).matches() && buf.toString().isBlank()) {
                heading = l.replaceFirst("^#+\\s*", "");
            }
            buf.append(l).append('\n');
            if (buf.length() >= MAX_CHARS) {
                String s = buf.toString();
                int cut = Math.max(s.lastIndexOf(". ", MAX_CHARS), s.lastIndexOf('\n', MAX_CHARS));
                if (cut < MAX_CHARS / 2) cut = MAX_CHARS - 1;
                int end = Math.min(cut + 1, s.length());
                flush(out, heading, s.substring(0, end));
                String carry = s.substring(Math.max(0, end - OVERLAP_CHARS));
                buf.setLength(0);
                buf.append(carry);
            }
        }
        flush(out, heading, buf.toString());
        return out;
    }

    private static void flush(List<Chunk> out, String heading, String body) {
        String b = body.strip();
        if (b.length() < 60) return;
        out.add(new Chunk(heading, b));
    }
}
