# CineAgent Studio — Demonstration Fallback Strategy & Contingency Plan

This document outlines the operational failure plan for presenting **CineAgent Studio** live during a hackathon or public presentation.

---

## 🎯 Primary Execution Mode
- **Mode**: Live Multi-Agent Pipeline Execution (`CINEAGENT_DEMO_MODE=false`).
- **Model**: `GEMINI_MODEL=gemini-3.1-flash-lite`.
- **Database**: Live ClickHouse Cloud instance via `mcp-clickhouse`.
- **Deployment**: Render Free Web Service (`https://cineagent-studio.onrender.com`).

---

## 🛠 Multi-Tier Fallback Hierarchy

```
[Tier 1: Live Gemini Pipeline]
              │
              ▼ (If transient 429 / network error occurs)
[Tier 2: Single Manual Retry & Pre-warmed Render Instance]
              │
              ▼ (If Gemini API remains rate-limited)
[Tier 3: Pre-Generated Real Production Plan Payload]
              │
              ▼ (If complete offline environment required)
[Tier 4: CINEAGENT_DEMO_MODE=true Local Offline Backup]
```

### Tier 1: Primary Live Execution
- Execute the concept intake live on stage.
- Allow the 5-agent pipeline to generate Story, Screenplay, Breakdown, Budget, Schedule, and ClickHouse Insights live.

### Tier 2: Single Manual Retry for Transient Rate Limits (HTTP 429)
- If Gemini API returns a transient 429 rate limit error:
  1. Wait 5–10 seconds.
  2. Click **Generate Production Plan** once more.
  3. The built-in request locking and retry mechanism will handle transient rate limits gracefully.

### Tier 3: Pre-Generated Real Production Plan Payload
- If Gemini API experiences prolonged rate limits:
  1. Load a previously generated real production plan for *The Last Monsoon* (stored locally in browser state or JSON fixture).
  2. Present the actual agent-generated screenplay, breakdown matrix, budget reconciliation, schedule, and ClickHouse analytics without re-triggering LLM calls.

### Tier 4: Offline Demo Mode (`CINEAGENT_DEMO_MODE=true`)
- Used ONLY if no internet connection or Gemini API availability is completely severed.
- Set `CINEAGENT_DEMO_MODE=true` in `.env` or query string.
- Transparently state: *"For offline presentation, we are using local cached production plan outputs."*

---

## 🔒 Contingency Guidelines
- **Transparent Communication**: Never pretend offline demo data is live AI generation if Tier 4 is activated.
- **Pre-warming**: Always access the Render URL 5 minutes before the demo to wake up the Render Free instance from 15-minute idle sleep.
