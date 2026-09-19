package ai.money.mentor.backend.rag;

/** A retrieved passage, numbered [S1]… in prompts and rendered as a source chip in the UI. */
public record Citation(String id, String authority, String title, String section, String sectionOld,
        String taxYear, String url, String snippet, double score) {

    public Citation withId(String newId) {
        return new Citation(newId, authority, title, section, sectionOld, taxYear, url, snippet, score);
    }
}
