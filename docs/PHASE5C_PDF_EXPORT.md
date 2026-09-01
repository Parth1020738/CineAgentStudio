# Phase 5C — PDF Document Generation Specification

## 1. Executive Summary
Phase 5C implements professional server-side PDF document generation for **CineAgent Studio**. It renders industry-standard PDF files for **Screenplays**, **Line-Item Budgets**, and **Shooting Schedules (Stripboards)** from already validated canonical export packages without calling Google Gemini or executing ClickHouse queries.

---

## 2. PDF Library Selection
* **Selected Library**: `pdfkit` (v0.16.0+)
* **Rationale**: Pure JavaScript, lightweight Node.js PDF document generation engine. Runs completely on the server side with zero headless browser / Chromium overhead and zero DOM dependencies. Supports streaming output directly into Express response buffers.

---

## 3. Supported PDF Export Types

| Export Type Enum | Target PDF File Pattern | Rendered Sections & Formatting |
| :--- | :--- | :--- |
| `SCREENPLAY_PDF` | `<slug>-screenplay.pdf` | Monospaced Courier/Courier-Bold font, standard screenplay margins, uppercase scene headings (`INT. LOCATION - TIME`), action blocks, centered character names, indented dialogue blocks, parentheticals, transitions. |
| `BUDGET_PDF` | `<slug>-budget.pdf` | Helvetica layout, title header, Financial Overview metrics, Budget Reconciliation Summary (`scene_linked + project_wide + contingency = estimated_total`), Category breakdown table, Major cost drivers list, Recommendations, and Assumptions. |
| `SCHEDULE_PDF` | `<slug>-schedule.pdf` | Stripboard layout, total shoot days header, optimization summary metrics, day-by-day shooting cards (Day #, date label, location, time of day, scheduled scene numbers, required cast, extras count, daily cost, setup notes, rationale, risks). |

---

## 4. Server API Contract (`POST /api/export`)

### Request
```json
{
  "exportType": "SCREENPLAY_PDF",
  "projectId": "neon_horizon_001",
  "title": "Neon Horizon",
  "productionPlan": { ... }
}
```

### Response Headers
* `Content-Type`: `application/pdf`
* `Content-Disposition`: `attachment; filename="neon-horizon-screenplay.pdf"`

### Response Body
Raw binary PDF document stream starting with magic byte header `%PDF-1.3`.

---

## 5. Data Fidelity & Verification
* **No Regeneration**: PDF rendering reads strictly from validated `ProductionExportPackage` data models.
* **No Financial Alterations**: `estimated_total` and category sums are rendered without recomputation.
* **Coverage Verification**: Screenplay scenes == Breakdown scenes == Schedule day scene allocations.

---

## 6. Security & Secret Sanitization
All export data passed to the PDF compiler is processed through `sanitizeExportPayload`. Object keys matching `GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`, `secret`, `credential`, or `token` are scrubbed before rendering. Generated PDF binary buffers contain zero API keys or server credentials.

---

## 7. Demo Mode vs. Live Mode Behavior

### Demo Mode (`CINEAGENT_DEMO_MODE=true`)
* Exports automatically render PDF documents from deterministic offline demo fixtures ([`server/fixtures/demoFixtures.js`](file:///c:/Meet/Codin/Repo/CineAgentStudio/server/fixtures/demoFixtures.js)).
* Completes in <150ms with zero LLM API calls and zero ClickHouse queries.

### Live Mode (`CINEAGENT_DEMO_MODE=false`)
* Renders PDF documents using the already generated production plan passed in the request body.
* Makes **ZERO** subsequent calls to Google Gemini or ClickHouse during PDF compilation.

---

## 8. Manual & Automated Verification Results
* **Automated Unit Tests**: 218 passing unit tests (14 dedicated Phase 5C PDF export unit tests).
* **Buffer Magic Header**: Verified `%PDF` magic bytes across all 3 PDF export types.
* **Client Build**: Production client bundle built cleanly in 150ms.
