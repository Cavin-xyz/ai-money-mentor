# FinMind — Stop Guessing. Start Growing.

Every number is **calculated** by a Java engine, every rule is **cited** from official sources
(Income Tax Department, SEBI, RBI, AMFI), and the explanation is written by a **local LLM** —
nothing leaves the laptop.

```
React UI ──SSE──▶ Spring Boot orchestrator
                   1 input → 2 memory (SQLite) → 3 financial engine (Java, rules JSON)
                   → 4 knowledge RAG (Qdrant + FTS5) → 5 context builder
                   → 6 local LLM (Ollama, qwen3.5:4b) → 7 safety & trust layer → explainable result
```

Tools: FIRE Planner · Money Health Score · Tax Wizard · Life Events · Couple's Planner · Portfolio X-Ray · Scam Shield.

## Run it

Prerequisites (already set up on the demo laptop): portable JDK in `tools/jdk`, Qdrant in `tools/qdrant`,
Ollama with `qwen3.5:4b` and `bge-m3-cpu` (`ollama create bge-m3-cpu -f backend/ollama/Modelfile.embed`),
Node 20+, Python 3 with `pip install casparser`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1            # start everything, open http://localhost:8080
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -Rebuild   # after code changes
powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -Ingest    # after adding knowledge documents
```

Development: run the backend with `backend\mvnw spring-boot:run` (JAVA_HOME = `tools\jdk`) and the UI with
`npm run dev` in `frontend/` (Vite proxies `/api` to :8080).

## Checks

| What | Command |
|---|---|
| Tax engine + safety layer unit tests | `backend\mvnw test -Dtest=TaxEngineTest,SafetyLayerTest` |
| RAG + answer accuracy (backend running) | `python scripts/run-eval.py` |
| Frontend lint / build | `npm run lint` · `npm run build` in `frontend/` |

Current eval: retrieval hit@4 8/8, answer accuracy 8/8, median latency ≈3 s (8-question seed set).

## Where the team's work goes

| Owner | Files |
|---|---|
| T1 — knowledge curator | Save official documents to `backend/knowledge/raw/`, list them in `backend/knowledge/manifest.yaml`, then run with `-Ingest`. incometaxindia.gov.in blocks scripts — save pages from a browser. |
| T2 — rules & data | Verify `backend/src/main/resources/rules/*.json` (every value has a source/verified date; `confirmed: false` rows need checking, especially the old→new section map). Add e-filing calculator cases to `TaxEngineTest`. Add RBI lending-app snapshot as `data/rbi/dla.json`, the Nifty 50 TRI figure in `limits.json`. |
| T3 — eval, demo, QA | Grow `backend/eval/questions.json` to 30–40 questions; write the demo script; check each screen at 375 px and desktop. Have a native speaker review Hindi/Telugu/Tamil output. |

## Honest limits

- Tax engine covers resident individuals below 60 with salary income; surcharge marginal relief is modelled, special-rate income (capital gains) is not.
- Fund overlap is estimated by category until a holdings snapshot is added; expense ratios are category averages until AMFI's TER data is loaded.
- Explanations come from a 4B-parameter model: numbers are guarded by the safety layer, wording is not perfect — especially in Indian languages.
- Educational guidance, not investment, tax or legal advice.
