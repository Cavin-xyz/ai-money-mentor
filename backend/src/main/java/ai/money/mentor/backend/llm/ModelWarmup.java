package ai.money.mentor.backend.llm;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Loads both models into memory at startup so the first real request isn't a 50-second cold start. */
@Component
public class ModelWarmup {

    private static final Logger log = LoggerFactory.getLogger(ModelWarmup.class);

    private final LocalLlmService llm;
    private final EmbeddingModel embeddings;

    public ModelWarmup(LocalLlmService llm, EmbeddingModel embeddings) {
        this.llm = llm;
        this.embeddings = embeddings;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warm() {
        CompletableFuture.runAsync(() -> {
            long t = System.currentTimeMillis();
            try {
                embeddings.embed("warm-up");
                llm.chat("Reply with the single word OK.", List.of(new UserMessage("ping")));
                log.info("Models warmed up in {} ms", System.currentTimeMillis() - t);
            } catch (Exception e) {
                log.warn("Model warm-up skipped: {}", e.getMessage());
            }
        });
    }
}
