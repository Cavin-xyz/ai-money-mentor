package ai.money.mentor.backend.rag;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import ai.money.mentor.backend.rules.RulesRepository;
import ai.money.mentor.backend.rules.RulesRepository.SectionMapping;

/**
 * Almost every section number changed in the Income-tax Act 2025, but users keep typing the
 * old ones. Queries are expanded with both numbers before searching ("80C" → also "Section 123").
 */
@Component
public class SectionMapper {

    private static final Pattern SECTION_REF = Pattern.compile(
            "(?i)(?:section|sec\\.?|u/s)\\s*(\\d{1,3}[A-Z]{0,5}(?:\\s?\\(\\w{1,4}\\))*)|\\b(\\d{2,3}[A-Z]{1,5}(?:\\(\\w{1,4}\\))*)\\b");

    private final List<SectionMapping> map;

    public SectionMapper(RulesRepository rules) {
        this.map = rules.sectionMap();
    }

    /** "Can I claim 80C in new regime?" → adds "Section 123 (formerly 80C) … Section 202 new regime". */
    public String expand(String query) {
        if (query == null) return "";
        Set<String> extra = new LinkedHashSet<>();
        String q = query.toUpperCase(Locale.ROOT).replace(" ", "");
        for (var m : map) {
            String old = m.oldSection().toUpperCase(Locale.ROOT).replace(" ", "");
            boolean mentionsOld = Pattern.compile("(?<![0-9A-Z])" + Pattern.quote(old) + "(?![0-9A-Z])").matcher(q).find();
            boolean mentionsNew = !"SCHEDULE".equalsIgnoreCase(m.newSection())
                    && Pattern.compile("SECTION" + Pattern.quote(m.newSection().toUpperCase(Locale.ROOT)) + "(?![0-9])").matcher(q).find();
            if (mentionsOld) extra.add("Section " + m.newSection() + " (formerly " + m.oldSection() + ") " + m.topic());
            else if (mentionsNew) extra.add("formerly section " + m.oldSection() + " " + m.topic());
        }
        String lower = query.toLowerCase(Locale.ROOT);
        if (lower.contains("new regime") || lower.contains("new tax regime")) extra.add("Section 202 new tax regime (formerly 115BAC)");
        if (lower.contains("rebate")) extra.add("Section 156 rebate (formerly 87A)");
        return extra.isEmpty() ? query : query + " | " + String.join(" | ", extra);
    }

    /** Section numbers mentioned in a passage, e.g. ["123", "80C"]. */
    public List<String> sectionsIn(String text) {
        List<String> out = new ArrayList<>();
        Matcher mt = SECTION_REF.matcher(text == null ? "" : text);
        while (mt.find() && out.size() < 6) {
            String s = (mt.group(1) != null ? mt.group(1) : mt.group(2)).replace(" ", "");
            if (!out.contains(s)) out.add(s);
        }
        return out;
    }

    /** New/old pair for a section mentioned in a passage, e.g. "80C" → ["123","80C"]. */
    public String[] pair(String section) {
        if (section == null) return new String[] { null, null };
        for (var m : map) {
            if (m.oldSection().equalsIgnoreCase(section)) return new String[] { m.newSection(), m.oldSection() };
            if (m.newSection().equalsIgnoreCase(section)) return new String[] { m.newSection(), m.oldSection() };
        }
        return new String[] { section, null };
    }
}
