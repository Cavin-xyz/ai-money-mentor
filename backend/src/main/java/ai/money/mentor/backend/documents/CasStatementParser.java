package ai.money.mentor.backend.documents;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Parses a CAMS/KFintech CAS PDF on this machine using casparser (via tools/cas_to_json.py).
 * The PDF goes to a temp file that is deleted immediately; the password is passed through an
 * environment variable, never the command line.
 */
@Component
public class CasStatementParser {

    private static final Logger log = LoggerFactory.getLogger(CasStatementParser.class);

    private final JsonMapper jsonMapper;
    private final String python;
    private final Path script;

    public CasStatementParser(JsonMapper jsonMapper, @Value("${mentor.python:python}") String python,
            @Value("${mentor.cas-script:tools/cas_to_json.py}") String script) {
        this.jsonMapper = jsonMapper;
        this.python = python;
        this.script = resolveScript(script);
    }

    private static Path resolveScript(String configured) {
        Path script = Path.of(configured).toAbsolutePath().normalize();
        if (Files.exists(script)) return script;

        // The demo may start the jar from the repository root, while development
        // starts Spring Boot from backend/. Support both working directories.
        Path fromRepositoryRoot = Path.of("backend").resolve(configured).toAbsolutePath().normalize();
        return Files.exists(fromRepositoryRoot) ? fromRepositoryRoot : script;
    }

    public JsonNode parse(byte[] pdf, String password) {
        Path tmp = null;
        try {
            tmp = Files.createTempFile("cas-", ".pdf");
            Files.write(tmp, pdf);
            var pb = new ProcessBuilder(python, script.toAbsolutePath().toString(), tmp.toString());
            pb.environment().put("CAS_PASSWORD", password == null ? "" : password);
            pb.environment().put("PYTHONIOENCODING", "utf-8");
            pb.redirectErrorStream(false);
            Process p = pb.start();
            byte[] out = p.getInputStream().readAllBytes();
            String err = new String(p.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!p.waitFor(90, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new IllegalArgumentException("Reading the statement took too long.");
            }
            if (p.exitValue() != 0) {
                log.info("casparser failed: {}", err.lines().reduce((a, b) -> b).orElse(err));
                if (err.toLowerCase().contains("password")) {
                    throw new IllegalArgumentException("Incorrect statement password.");
                }
                throw new IllegalArgumentException("Could not read this statement. Is it a CAMS/KFintech CAS PDF?");
            }
            return jsonMapper.readTree(new String(out, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalArgumentException("Statement parser is not available: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // temp dir is cleaned by the OS
                }
            }
        }
    }
}
