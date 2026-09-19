package ai.money.mentor.backend.common;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Indian-style money formatting (lakh/crore) and parsing of ₹ amounts in free text. */
public final class Money {

    // Units in English, Hindi (लाख/करोड़), Telugu (లక్ష/కోటి) and Tamil (லட்சம்/கோடி) so the safety check
    // reads translated explanations correctly.
    private static final Pattern RUPEE = Pattern.compile(
            "(?:₹|Rs\\.?|INR)\\s?([0-9][0-9,]*(?:\\.[0-9]+)?)\\s?"
                    + "(crores?|cr|lakhs?|lacs?|l|k|thousand|करोड़|करोड|लाख|कोटि|కోట్లు|కోటి|లక్షలు|లక్ష|கோடி|லட்சம்|லட்சங்கள்)?(?![A-Za-z])",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private Money() {
    }

    /** ₹1,48,750 */
    public static String inr(double amount) {
        long v = Math.round(amount);
        String sign = v < 0 ? "-" : "";
        return sign + "₹" + groupIndian(Math.abs(v));
    }

    /** ₹1.49L, ₹3.2 Cr, ₹48K, ₹950 */
    public static String compact(double amount) {
        String sign = amount < 0 ? "-" : "";
        double a = Math.abs(amount);
        if (a >= 1e7) return sign + "₹" + trim(a / 1e7) + " Cr";
        if (a >= 1e5) return sign + "₹" + trim(a / 1e5) + "L";
        if (a >= 1e4) return sign + "₹" + trim(a / 1e3) + "K";
        return sign + inr(a);
    }

    public static String pct(double value) {
        return trim(value) + "%";
    }

    public static String pct(double value, int decimals) {
        return String.format(Locale.ROOT, "%." + decimals + "f%%", value);
    }

    private static String trim(double x) {
        DecimalFormat f = new DecimalFormat(x >= 100 ? "0" : x >= 10 ? "0.#" : "0.##",
                DecimalFormatSymbols.getInstance(Locale.ROOT));
        return f.format(x);
    }

    private static String groupIndian(long v) {
        String s = Long.toString(v);
        if (s.length() <= 3) return s;
        String last3 = s.substring(s.length() - 3);
        String rest = s.substring(0, s.length() - 3);
        StringBuilder out = new StringBuilder();
        while (rest.length() > 2) {
            out.insert(0, "," + rest.substring(rest.length() - 2));
            rest = rest.substring(0, rest.length() - 2);
        }
        out.insert(0, rest);
        return out + "," + last3;
    }

    /** Parses user-typed numbers like "5,00,000", "12.5", "" → 0. */
    public static double parse(Object raw) {
        if (raw == null) return 0;
        if (raw instanceof Number n) return n.doubleValue();
        String s = raw.toString().replaceAll("[₹,\\s]", "");
        if (s.isEmpty()) return 0;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Every ₹ amount mentioned in a piece of text, normalised to rupees. */
    public static List<Double> amountsIn(String text) {
        List<Double> out = new ArrayList<>();
        if (text == null) return out;
        Matcher m = RUPEE.matcher(text);
        while (m.find()) {
            double base;
            try {
                base = Double.parseDouble(m.group(1).replace(",", ""));
            } catch (NumberFormatException e) {
                continue;
            }
            String unit = m.group(2) == null ? "" : m.group(2).toLowerCase(Locale.ROOT);
            double mult = switch (unit) {
                case "cr", "crore", "crores", "करोड़", "करोड", "कोटि", "కోటి", "కోట్లు", "கோடி" -> 1e7;
                case "l", "lakh", "lakhs", "lac", "lacs", "लाख", "లక్ష", "లక్షలు", "லட்சம்", "லட்சங்கள்" -> 1e5;
                case "k", "thousand" -> 1e3;
                default -> 1;
            };
            out.add(base * mult);
        }
        return out;
    }
}
