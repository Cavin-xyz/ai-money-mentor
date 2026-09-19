package ai.money.mentor.backend.llm;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.content.Media;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;

import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The only place the app talks to the local model. Everything runs through Ollama on
 * this machine; no prompt or user data leaves the laptop.
 */
@Service
public class LocalLlmService {

    private static final Logger log = LoggerFactory.getLogger(LocalLlmService.class);

    private final ChatClient chatClient;
    private final JsonMapper jsonMapper;
    private final String chatModel;
    private final String structuredModel;
    private final int maxOutputTokens;

    public LocalLlmService(ChatClient.Builder builder, JsonMapper jsonMapper,
            @Value("${spring.ai.ollama.chat.model}") String chatModel,
            @Value("${mentor.llm.structured-model}") String structuredModel,
            @Value("${mentor.llm.max-output-tokens}") int maxOutputTokens) {
        this.chatClient = builder.build();
        this.jsonMapper = jsonMapper;
        this.chatModel = chatModel;
        this.structuredModel = structuredModel;
        this.maxOutputTokens = maxOutputTokens;
    }

    public String chatModel() {
        return chatModel;
    }

    public String structuredModel() {
        return structuredModel;
    }

    /** Structured output: Ollama constrains decoding to the JSON Schema of {@code type}. */
    public <T> T generate(String system, String user, Class<T> type) {
        var converter = new BeanOutputConverter<>(type, jsonMapper);
        String raw = call(() -> chatClient.prompt()
                .system(system)
                .user(user)
                .options(OllamaChatOptions.builder()
                        .model(structuredModel)
                        .outputSchema(converter.getJsonSchema())
                        .numPredict(maxOutputTokens))
                .call()
                .content());
        return converter.convert(raw);
    }

    /** Structured output from an image (Form 16 photo, statement screenshot). */
    public <T> T generateFromImage(String system, String user, MimeType mimeType, byte[] image, Class<T> type) {
        var converter = new BeanOutputConverter<>(type, jsonMapper);
        var media = new Media(mimeType, new ByteArrayResource(image));
        String raw = call(() -> chatClient.prompt()
                .system(system)
                .user(u -> u.text(user).media(media))
                .options(OllamaChatOptions.builder()
                        .model(chatModel)
                        .outputSchema(converter.getJsonSchema())
                        .numPredict(maxOutputTokens))
                .call()
                .content());
        return converter.convert(raw);
    }

    /** Free-form JSON (no schema) — used where the shape is open-ended. */
    public JsonNode generateJson(String system, String user) {
        String raw = call(() -> chatClient.prompt()
                .system(system)
                .user(user)
                .options(OllamaChatOptions.builder()
                        .model(structuredModel)
                        .format("json")
                        .numPredict(maxOutputTokens))
                .call()
                .content());
        return jsonMapper.readTree(raw);
    }

    /** Free-form JSON from text plus an image. */
    public JsonNode generateJson(String system, String user, MimeType mimeType, byte[] image) {
        var media = new Media(mimeType, new ByteArrayResource(image));
        String raw = call(() -> chatClient.prompt()
                .system(system)
                .user(u -> u.text(user).media(media))
                .options(OllamaChatOptions.builder()
                        .model(chatModel)
                        .format("json")
                        .numPredict(maxOutputTokens))
                .call()
                .content());
        return jsonMapper.readTree(raw);
    }

    /** Blocking multi-turn chat. */
    public String chat(String system, List<Message> messages) {
        return call(() -> chatClient.prompt()
                .system(system)
                .messages(messages)
                .options(OllamaChatOptions.builder().model(chatModel).numPredict(maxOutputTokens))
                .call()
                .content());
    }

    /** Token stream for chat-style answers. */
    public Flux<String> stream(String system, List<Message> messages) {
        return chatClient.prompt()
                .system(system)
                .messages(messages)
                .options(OllamaChatOptions.builder().model(chatModel).numPredict(maxOutputTokens))
                .stream()
                .content()
                .onErrorMap(LocalLlmService::isConnectionFailure,
                        e -> new LlmUnavailableException("Local model is not reachable", e));
    }

    private String call(java.util.function.Supplier<String> request) {
        long start = System.currentTimeMillis();
        try {
            String out = request.get();
            log.debug("LLM call took {} ms", System.currentTimeMillis() - start);
            if (out == null || out.isBlank()) {
                throw new LlmUnavailableException("Local model returned an empty response", null);
            }
            return out;
        } catch (LlmUnavailableException e) {
            throw e;
        } catch (RuntimeException e) {
            if (isConnectionFailure(e)) {
                throw new LlmUnavailableException("Local model is not reachable", e);
            }
            throw e;
        }
    }

    static boolean isConnectionFailure(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.net.ConnectException
                    || t instanceof org.springframework.web.client.ResourceAccessException
                    || t instanceof java.net.http.HttpTimeoutException) {
                return true;
            }
        }
        return false;
    }
}
