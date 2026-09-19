package ai.money.mentor.backend.modules;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.util.MimeType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ai.money.mentor.backend.documents.CasStatementParser;
import ai.money.mentor.backend.engine.AmfiService;
import ai.money.mentor.backend.llm.LocalLlmService;
import ai.money.mentor.backend.orchestrator.AdvisorPipeline;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Portfolio X-Ray input: a CAMS/KFintech CAS PDF (parsed locally; the file is never stored),
 * a statement screenshot (read by the local vision model) or manual rows.
 */
@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    public record ScreenshotHoldings(List<Row> holdings) {
        public record Row(String name, double value) {
        }
    }

    private final AdvisorPipeline pipeline;
    private final CasStatementParser cas;
    private final AmfiService amfi;
    private final LocalLlmService llm;
    private final JsonMapper json;

    public PortfolioController(AdvisorPipeline pipeline, CasStatementParser cas, AmfiService amfi, LocalLlmService llm,
            JsonMapper json) {
        this.pipeline = pipeline;
        this.cas = cas;
        this.amfi = amfi;
        this.llm = llm;
        this.json = json;
    }

    @PostMapping(path = "/stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "password", required = false) String password,
            @RequestParam(value = "holdings", required = false) String holdingsJson,
            @RequestParam(value = "targetEquityPct", required = false) String targetEquityPct,
            @RequestHeader(value = "X-Profile-Id", required = false) String profileId,
            @RequestHeader(value = "X-Language", required = false) String language) throws IOException {
        Map<String, Object> req = new HashMap<>();
        if (targetEquityPct != null && !targetEquityPct.isBlank()) req.put("targetEquityPct", targetEquityPct);
        if (file != null && !file.isEmpty()) {
            String type = file.getContentType() == null ? "" : file.getContentType();
            if (type.startsWith("image/")) {
                var rows = llm.generateFromImage("Extract mutual fund holdings from this statement screenshot. Only funds and their current value in rupees.",
                        "List every fund name and its current value.", MimeType.valueOf(type), file.getBytes(), ScreenshotHoldings.class);
                List<Map<String, Object>> holdings = new ArrayList<>();
                if (rows.holdings() != null) rows.holdings().forEach(h -> holdings.add(Map.of("name", h.name(), "value", h.value())));
                req.put("holdings", holdings);
                req.put("source", "screenshot");
            } else {
                req.put("holdings", fromCas(cas.parse(file.getBytes(), password)));
                req.put("source", "statement");
            }
        } else if (holdingsJson != null && !holdingsJson.isBlank()) {
            req.put("holdings", json.readValue(holdingsJson, new TypeReference<List<Map<String, Object>>>() {
            }));
            req.put("source", "manual");
        } else {
            throw new IllegalArgumentException("Upload a statement or add your funds");
        }
        return pipeline.stream("portfolio", req, profileId, language);
    }

    /** Autocomplete for the manual row editor. */
    @GetMapping("/schemes")
    public List<Map<String, Object>> schemes(@RequestParam("q") String q) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (var s : amfi.search(q, 8)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", s.code());
            m.put("name", s.name());
            m.put("plan", s.plan());
            m.put("category", s.category());
            m.put("nav", s.nav());
            m.put("navDate", s.navDate());
            out.add(m);
        }
        return out;
    }

    private static List<Map<String, Object>> fromCas(JsonNode parsed) {
        List<Map<String, Object>> holdings = new ArrayList<>();
        for (JsonNode s : parsed.path("schemes")) {
            double value = s.path("value").asDouble();
            if (value <= 0) continue;
            List<Map<String, Object>> flows = new ArrayList<>();
            for (JsonNode t : s.path("transactions")) {
                String type = t.path("type").asString("").toUpperCase();
                double amt = Math.abs(t.path("amount").asDouble());
                double signed;
                if (type.contains("REDEMPTION") || type.contains("SWITCH_OUT") || type.contains("DIVIDEND_PAYOUT")) signed = amt;
                else if (type.contains("PURCHASE") || type.contains("SWITCH_IN") || type.contains("TAX")) signed = -amt;
                else continue;
                flows.add(Map.of("date", t.path("date").asString(), "amount", signed));
            }
            Map<String, Object> h = new HashMap<>();
            h.put("name", s.path("name").asString());
            h.put("value", value);
            h.put("amfi", s.path("amfi").asString(""));
            h.put("flows", flows);
            holdings.add(h);
        }
        return holdings;
    }
}
