package ai.money.mentor.backend.orchestrator;

import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Function;

import ai.money.mentor.backend.common.CalcTrace;
import ai.money.mentor.backend.memory.UserContext;
import tools.jackson.databind.node.ObjectNode;

/**
 * One product module (FIRE, Health Score, …). The advisor owns the deterministic half —
 * engine call, response shape, template text — and describes what the LLM may rewrite.
 */
public interface ModuleAdvisor {

    /** URL segment, e.g. "fire" → /api/fire/stream */
    String module();

    String label();

    Prepared prepare(Map<String, Object> request, UserContext user);

    /**
     * @param result      response in the shape the UI already renders; numbers filled by the engine,
     *                    text fields filled from templates (so it is complete even with no LLM)
     * @param trace       calculation steps + facts the explanation may quote
     * @param query       what to search the knowledge base for
     * @param taxYear     restricts retrieval to rules valid for this year
     * @param narrative   what the LLM should write, or null for calc-only modules
     * @param summary     one line for the interaction history ("FIRE: ₹3.2 Cr by 50")
     * @param regimeWinner "old"/"new" when the module made a regime call (consistency check), else null
     */
    record Prepared(ObjectNode result, CalcTrace trace, String query, String taxYear, NarrativeTask<?> narrative,
            String summary, String regimeWinner) {
    }

    /**
     * @param schema       record type the model must fill (Ollama constrains output to its JSON Schema)
     * @param instructions module-specific writing brief
     * @param texts        extracts every text field of a narrative for the safety checks
     * @param merge        writes an accepted narrative into the result
     */
    record NarrativeTask<N>(Class<N> schema, String instructions, Function<N, List<String>> texts,
            BiConsumer<ObjectNode, N> merge) {

        @SuppressWarnings("unchecked")
        public List<String> textsOf(Object n) {
            return texts.apply((N) n);
        }

        @SuppressWarnings("unchecked")
        public void mergeInto(ObjectNode result, Object n) {
            merge.accept(result, (N) n);
        }
    }
}
