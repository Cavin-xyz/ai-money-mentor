package ai.money.mentor.backend.llm;

/** The local model could not be reached or produced nothing usable. Callers fall back to templates. */
public class LlmUnavailableException extends RuntimeException {

    public LlmUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
