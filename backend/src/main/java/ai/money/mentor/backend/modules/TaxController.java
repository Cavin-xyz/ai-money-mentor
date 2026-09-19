package ai.money.mentor.backend.modules;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.http.MediaType;
import org.springframework.util.MimeType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.documents.PdfText;
import ai.money.mentor.backend.engine.Inputs;
import ai.money.mentor.backend.engine.TaxEngine;
import ai.money.mentor.backend.engine.TaxInput;
import ai.money.mentor.backend.llm.LocalLlmService;
import ai.money.mentor.backend.orchestrator.ChatStreamer;
import ai.money.mentor.backend.rules.RulesRepository;

/** Tax Wizard: deterministic regime comparison, grounded streaming chat, and local Form 16 extraction. */
@RestController
public class TaxController {

    public record Form16Data(
            @JsonPropertyDescription("Employer name") String employer,
            @JsonPropertyDescription("Financial year, e.g. 2025-26") String financialYear,
            @JsonPropertyDescription("Gross salary in rupees (number only)") Double grossSalary,
            @JsonPropertyDescription("Basic salary in rupees, if shown") Double basicSalary,
            @JsonPropertyDescription("HRA received in rupees, if shown") Double hraReceived,
            @JsonPropertyDescription("Professional tax in rupees") Double professionalTax,
            @JsonPropertyDescription("Section 80C / 123 deductions claimed") Double sec80C,
            @JsonPropertyDescription("Section 80D deductions claimed") Double sec80D,
            @JsonPropertyDescription("Section 80CCD(1B) own NPS claimed") Double sec80CCD1B,
            @JsonPropertyDescription("Employer NPS contribution 80CCD(2)") Double employerNps,
            @JsonPropertyDescription("Home-loan interest claimed (24(b))") Double homeLoanInterest,
            @JsonPropertyDescription("Total TDS deducted by the employer") Double tdsDeducted,
            @JsonPropertyDescription("'old' or 'new' if the form shows which regime was used") String regimeUsed) {
    }

    private static final String WIZARD_BRIEF = """
            MODULE: Tax Wizard (chat).
            Answer the user's latest question concisely with bullet points where helpful.
            If CALCULATIONS contains a regime comparison, use those exact figures for any Old vs New comparison.
            The new regime is the default: if it is the better one, say no opt-out is needed. Only suggest opting out
            of the new regime when CALCULATIONS shows the old regime is cheaper. Don't invent filing steps.
            If SOURCES don't cover the question, say you couldn't find it in the official documents loaded on this
            device and suggest incometaxindia.gov.in — do not guess.
            Mention a Chartered Accountant for complex cases (capital gains, business income, foreign assets).""";

    private final TaxEngine taxEngine;
    private final RulesRepository rules;
    private final ChatStreamer chat;
    private final LocalLlmService llm;

    public TaxController(TaxEngine taxEngine, RulesRepository rules, ChatStreamer chat, LocalLlmService llm) {
        this.taxEngine = taxEngine;
        this.rules = rules;
        this.chat = chat;
        this.llm = llm;
    }

    @PostMapping("/api/tax/compare")
    public Map<String, Object> compare(@RequestBody Map<String, Object> body) {
        var c = taxEngine.compare(toInput(body), Inputs.str(body, "taxYear", rules.defaultTaxYear()));
        return toPayload(c);
    }

    @PostMapping(path = "/api/tax/wizard/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter wizard(@RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Profile-Id", required = false) String profileId,
            @RequestHeader(value = "X-Language", required = false) String language) {
        List<Map<String, Object>> history = Inputs.list(body, "history");
        if (history.isEmpty()) throw new IllegalArgumentException("Ask a question to get started");
        String taxYear = Inputs.str(body, "taxYear", rules.defaultTaxYear());
        String question = String.valueOf(history.get(history.size() - 1).getOrDefault("text", ""));

        List<Message> prior = new ArrayList<>();
        for (int i = Math.max(0, history.size() - 7); i < history.size() - 1; i++) {
            var m = history.get(i);
            String text = String.valueOf(m.getOrDefault("text", ""));
            prior.add("assistant".equals(m.get("role")) ? new AssistantMessage(text) : new UserMessage(text));
        }

        Map<String, Object> inputs = Inputs.map(body, "taxInputs");
        CalcTrace trace = null;
        String winner = null;
        Object payload = null;
        if (Inputs.num(inputs, "grossSalary") > 0) {
            var c = taxEngine.compare(toInput(inputs), taxYear);
            trace = c.trace();
            winner = c.winner();
            payload = toPayload(c);
        }
        return chat.stream(new ChatStreamer.ChatRequest("tax", WIZARD_BRIEF, prior, question, question + " " + taxYear,
                trace, winner, taxYear, profileId, inputs, payload, language));
    }

    @PostMapping(path = "/api/documents/form16", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> form16(@RequestPart("file") MultipartFile file,
            @RequestParam(value = "password", required = false) String password) throws IOException {
        String type = file.getContentType() == null ? "" : file.getContentType();
        String system = """
                You extract figures from an Indian Form 16 (salary TDS certificate). Return numbers in rupees without
                commas or symbols. Use null for anything not present. Do not guess. Ignore PAN, TAN and addresses.""";
        Form16Data data;
        if (type.startsWith("image/")) {
            data = llm.generateFromImage(system, "Extract the Form 16 figures.", MimeType.valueOf(type), file.getBytes(), Form16Data.class);
        } else {
            String text = PdfText.truncate(PdfText.extract(file.getBytes(), password), 12_000);
            data = llm.generate(system, "FORM 16 TEXT:\n" + text, Form16Data.class);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("form16", data);
        out.put("note", "Read on this device; the file was not stored. Please check every figure before using it.");
        return out;
    }

    static TaxInput toInput(Map<String, Object> b) {
        return TaxInput.salary(Inputs.num(b, "grossSalary"))
                .otherIncome(Inputs.num(b, "otherIncome"))
                .basicSalary(Inputs.num(b, "basicSalary"))
                .hra(Inputs.num(b, "hraReceived"), Inputs.num(b, "rentPaid"), !"false".equals(Inputs.str(b, "metro", "true")))
                .sec80C(Inputs.num(b, "sec80C"))
                .sec80D(Inputs.num(b, "sec80D"))
                .sec80DParents(Inputs.num(b, "sec80DParents"))
                .sec80CCD1B(Inputs.num(b, "sec80CCD1B"))
                .employerNps(Inputs.num(b, "employerNps"))
                .homeLoanInterest(Inputs.num(b, "homeLoanInterest"))
                .professionalTax(Inputs.num(b, "professionalTax"));
    }

    static Map<String, Object> toPayload(TaxEngine.TaxComparison c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("taxYear", c.taxYear());
        m.put("taxYearLabel", c.taxYearLabel());
        m.put("act", c.act());
        m.put("oldRegime", c.oldRegime());
        m.put("newRegime", c.newRegime());
        m.put("winner", c.winner());
        m.put("savings", c.savings());
        m.put("gaps", c.gaps());
        m.put("oldRegimeTaxIfMaxed", c.oldRegimeTaxIfMaxed());
        m.put("breakEvenExtraDeductions", c.breakEvenExtraDeductions());
        m.put("calculations", c.trace().steps());
        m.put("assumptions", c.trace().assumptions());
        return m;
    }
}
