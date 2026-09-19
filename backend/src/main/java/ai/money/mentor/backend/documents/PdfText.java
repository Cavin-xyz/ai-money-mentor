package ai.money.mentor.backend.documents;

import java.io.IOException;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

/** Local PDF text extraction (PDFBox). Uploaded files are processed in memory and never stored. */
public final class PdfText {

    private PdfText() {
    }

    public static String extract(byte[] pdf, String password) {
        try (PDDocument doc = password == null || password.isBlank()
                ? Loader.loadPDF(pdf)
                : Loader.loadPDF(pdf, password)) {
            var stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(doc);
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException e) {
            throw new IllegalArgumentException("This PDF is password-protected. Please enter its password.");
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read this PDF: " + e.getMessage());
        }
    }

    /** Keeps prompts inside the model's context window. */
    public static String truncate(String text, int maxChars) {
        if (text == null) return "";
        String collapsed = text.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        return collapsed.length() <= maxChars ? collapsed : collapsed.substring(0, maxChars) + "\n…[truncated]";
    }
}
