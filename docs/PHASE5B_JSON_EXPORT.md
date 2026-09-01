# Phase 5B — Canonical Production Plan JSON Export Specification

## 1. Executive Summary
Phase 5B implements the first downloadable export file format for **CineAgent Studio**: formatted **JSON**. The export service transforms already-generated canonical production packages (`ProductionExportPackage`) into downloadable JSON attachments without re-running Google Gemini agents or executing ClickHouse database queries.

---

## 2. API Endpoint Specification

### `POST /api/export`
Generates and returns a downloadable JSON file attachment containing the canonical export structure for the selected component.

#### Request Headers
`Content-Type: application/json`

#### Request Body
```json
{
  "exportType": "FULL_PRODUCTION_PACKAGE",
  "projectId": "neon_horizon_001",
  "title": "Neon Horizon",
  "productionPlan": {
    "storyPackage": { ... },
    "screenplay": { ... },
    "breakdown": { ... },
    "budget": { ... },
    "schedule": { ... },
    "insights": { ... }
  }
}
```

#### Response Headers
* `Content-Type`: `application/json; charset=utf-8`
* `Content-Disposition`: `attachment; filename="<safe-project-slug>-<component>.json"`

#### Response Body
A formatted, indented JSON file attachment (`JSON.stringify(exportPackage, null, 2)`).

---

## 3. Supported JSON Export Types

| Export Type Enum | Export Output Filename Pattern | Contents |
| :--- | :--- | :--- |
| `FULL_PRODUCTION_PACKAGE` | `<slug>-production-package.json` | Metadata + Story + Screenplay + Breakdown + Budget + Schedule + Insights |
| `SCREENPLAY` | `<slug>-screenplay.json` | Metadata + Story + Screenplay |
| `BREAKDOWN` | `<slug>-breakdown.json` | Metadata + Production Breakdown |
| `BUDGET` | `<slug>-budget.json` | Metadata + Budget & Line-Item Reconciliation |
| `SCHEDULE` | `<slug>-schedule.json` | Metadata + Shooting Schedule & Day Plans |
| `INSIGHTS` | `<slug>-insights.json` | Metadata + ClickHouse Production Insights |

---

## 4. Deterministic Filename Rules & Sanitization
The export service generates safe, path-traversal-free filenames using `getSafeExportFilename(title, exportType)` in [`server/services/exportService.js`](file:///c:/Meet/Codin/Repo/CineAgentStudio/server/services/exportService.js):
1. **Character Sanitization**: Strips non-alphanumeric characters (excluding spaces, hyphens, and underscores). Strips path traversal characters (`/ \ ..`).
2. **Slugification**: Converts to lower-case and replaces spaces with single hyphens (`-`). Fallback title defaults to `'project'`.
3. **Suffix & Extension**: Appends component suffix and `.json` extension.
4. **Examples**:
   - `Neon Horizon` + `FULL_PRODUCTION_PACKAGE` → `neon-horizon-production-package.json`
   - `Cyberpunk 2099!` + `BUDGET` → `cyberpunk-2099-budget.json`
   - `../../../etc/passwd` + `BREAKDOWN` → `etcpasswd-breakdown.json`

---

## 5. Export Validation & Data Integrity
Before serving the JSON attachment:
1. **Schema Validation**: Validates output against component Zod schemas (`StoryOutputSchema`, `ScreenplayOutputSchema`, `ProductionBreakdownSchema`, `BudgetOutputSchema`, `ScheduleOutputSchema`).
2. **Scene Count & Heading Alignment**: Screenplay scene count == Breakdown scene count == Schedule scene coverage.
3. **Budget Reconciliation Equality**: `scene_linked_cost_total + project_wide_cost_total + contingency_cost = estimated_total`.
4. **No Financial Recomputation**: Pre-computed totals and variances are preserved.

---

## 6. Security & Secret Sanitization
Export packages are sanitized recursively via `sanitizeExportPayload`. Any object keys containing sensitive patterns (`GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`, `secret`, `credential`, `token`) are scrubbed before JSON serialization.

---

## 7. Demo Mode vs. Live Mode Behavior

### Demo Mode (`CINEAGENT_DEMO_MODE=true`)
* Exports automatically load offline demo fixtures when `productionPlan` is omitted from the request body.
* Completes in <50ms with zero LLM API calls and zero ClickHouse credentials required.

### Live Mode (`CINEAGENT_DEMO_MODE=false`)
* Transforms the already-generated `productionPlan` passed in the request body.
* Makes **ZERO** subsequent calls to Google Gemini or ClickHouse during export.

---

## 8. Test Verification
* **Unit Tests**: 204 unit tests passing (17 dedicated Phase 5B JSON export tests).
* **Headers**: Verified `Content-Type` and `Content-Disposition` attachment headers.
* **Build**: Verified Vite client build completes in 308ms.
