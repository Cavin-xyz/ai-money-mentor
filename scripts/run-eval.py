"""Accuracy eval for the RAG + local LLM stack (needs the backend running on :8080).

    python scripts/run-eval.py            # all questions
    python scripts/run-eval.py --no-llm   # retrieval only (fast)

Reports retrieval hit@4, answer accuracy, safety-check pass rate and latency — numbers for the slides.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "http://localhost:8080"
QUESTIONS = Path(__file__).resolve().parent.parent / "backend" / "eval" / "questions.json"


def search(q, tax_year="2026-27"):
    url = f"{BASE}/api/knowledge/search?q={urllib.parse.quote(q)}&taxYear={tax_year}"
    return json.load(urllib.request.urlopen(url, timeout=60))


def ask(q, tax_year="2026-27"):
    body = json.dumps({"question": q, "taxYear": tax_year}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/knowledge/ask/stream", body,
                                 {"Content-Type": "application/json", "Accept": "text/event-stream"})
    event, result = None, None
    for raw in urllib.request.urlopen(req, timeout=300):
        line = raw.decode("utf-8").rstrip("\n")
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event == "result":
            result = json.loads(line[5:])
    return result or {}


def main():
    use_llm = "--no-llm" not in sys.argv
    qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    rows, hits, correct, safe, latencies = [], 0, 0, 0, []
    for q in qs:
        year = q.get("taxYear", "2026-27")
        cites = search(q["question"], year)
        if q.get("notFound"):
            hit = len(cites) == 0
        else:
            hit = any(q["source"].lower() in (c.get("title") or "").lower() for c in cites)
        hits += hit
        ok = passed = None
        if use_llm:
            t = time.time()
            res = ask(q["question"], year)
            latencies.append(time.time() - t)
            answer = res.get("answer", "")
            ok = all(re.search(f, answer, re.I) for f in q["facts"])
            passed = all(c["passed"] for c in res.get("trust", {}).get("checks", []))
            correct += ok
            safe += passed
        rows.append((q["id"], hit, ok, passed))
        print(f"{q['id']:16} retrieval={'PASS' if hit else 'miss'}"
              + ("" if not use_llm else f"  answer={'PASS' if ok else 'FAIL'}  checks={'PASS' if passed else 'warn'}"))

    n = len(qs)
    print("\n" + "-" * 48)
    print(f"Retrieval hit@4     {hits}/{n} = {hits / n:.0%}")
    if use_llm:
        print(f"Answer accuracy     {correct}/{n} = {correct / n:.0%}")
        print(f"Safety checks pass  {safe}/{n} = {safe / n:.0%}")
        print(f"Median latency      {sorted(latencies)[len(latencies) // 2]:.1f} s")


if __name__ == "__main__":
    main()
