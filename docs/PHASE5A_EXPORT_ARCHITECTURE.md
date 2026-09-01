# Phase 5A — Export Architecture & Data Contracts Specification

## 1. Executive Overview
Phase 5A establishes the canonical export architecture and data contracts for **CineAgent Studio**. It provides a single, deterministic server-side transformation mechanism that converts validated runtime objects (Story, Screenplay, Production Breakdown, Budget, Schedule, and ClickHouse Production Analytics) into structured, type-safe export packages ready for downstream rendering and rendering pipeline consumption.

---

## 2. Canonical Export Model (`ProductionExportPackage`)
The canonical export model is defined via Zod schemas in [`server/services/exportService.js`](file:///c:/Meet/Codin/Repo/CineAgentStudio/server/services/exportService.js).

```json
{
  "metadata": {
    "export_id": "export_1787675000000_a1b2c",
    "project_id": "neon_horizon_001",
    "project_title": "Neon Horizon",
    "export_type": "FULL_PRODUCTION_PACKAGE",
    "generated_at": "2026-08-25T18:57:00.000Z",
    "application_version": "1.0.0",
    "schema_version": "1.0"
  },
  "story": { /* StoryOutputSchema */ },
  "screenplay": { /* ScreenplayOutputSchema */ },
  "breakdown": { /* ProductionBreakdownSchema */ },
  "budget": { /* BudgetOutputSchema */ },
  "schedule": { /* ScheduleOutputSchema */ },
  "insights": { /* ClickHouse Production Insights */ }
}
```

---

## 3. Supported Export Types

| Export Type Enum | Target Artifact | Included Component Objects |
| :--- | :--- | :--- |
| `FULL_PRODUCTION_PACKAGE` | Complete Production Bible | Metadata, Story, Screenplay, Breakdown, Budget, Schedule, Insights |
| `SCREENPLAY` | Screenplay Script | Metadata, Story, Screenplay |
| `BREAKDOWN` | Scene Elements Sheet | Metadata, Production Breakdown |
| `BUDGET` | Production Line-Item Budget | Metadata, Budget Output & Reconciliation |
| `SCHEDULE` | Shooting Day Stripboard | Metadata, Schedule Output & Day Plans |
| `INSIGHTS` | ClickHouse Production Analytics | Metadata, Analytics Insights (7 Perspectives) |

---

## 4. Server API Contract

### Request: `POST /api/export`
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

### Response: HTTP 200 OK
```json
{
  "status": "success",
  "data": {
    "metadata": {
      "export_id": "export_1787675000000_x9y8z",
      "project_id": "neon_horizon_001",
      "project_title": "Neon Horizon",
      "export_type": "FULL_PRODUCTION_PACKAGE",
      "generated_at": "2026-08-25T18:57:00.000Z",
      "application_version": "1.0.0",
      "schema_version": "1.0"
    },
    "story": { ... },
    "screenplay": { ... },
    "breakdown": { ... },
    "budget": { ... },
    "schedule": { ... },
    "insights": { ... }
  }
}
```

---

## 5. Authoritative Data Sources & Integrity
The export service acts strictly as a data transformer and validator. It treats the output of upstream agents and ClickHouse queries as authoritative:
* **No LLM Regeneration**: Export operations do NOT invoke Google Gemini or call LLM agents.
* **No Direct DB Queries**: Export operations consume already aggregated insights payloads.
* **No Financial Recomputation**: `estimated_total`, line-item scene costs, and budget variances are preserved without recalculation.
* **Scene Fidelity**: Verifies that Screenplay scene count == Breakdown scene count == Schedule scene coverage.

---

## 6. Security & Credential Sanitization
All export objects undergo deterministic key sanitization before serialization. Any field containing patterns such as `GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`, `secret`, `credential`, or `token` is scrubbed from the export output.

---

## 7. Demo Mode Compatibility
When `CINEAGENT_DEMO_MODE=true` is set, calls to `POST /api/export` without an explicit `productionPlan` automatically construct the canonical package using deterministic offline demo fixtures ([`server/fixtures/demoFixtures.js`](file:///c:/Meet/Codin/Repo/CineAgentStudio/server/fixtures/demoFixtures.js)). Execution completes in <100ms with zero LLM quota consumption.

---

## 8. Future File-Generation Architecture (Phases 5B–5F Roadmap)
Phase 5A establishes the JSON data layer. Downstream sub-phases will map this canonical contract to rendered file formats:
* **Phase 5B**: PDF Generation (Screenplay PDF, Budget PDF, Schedule Stripboard PDF).
* **Phase 5C**: CSV / Spreadsheet Export (Breakdown Elements CSV, Line-Item Budget CSV).
* **Phase 5D**: Markdown & Production Bible Package Export (ZIP bundle).
* **Phase 5E**: React UI Export Workspace & Preview Dialog.
* **Phase 5F**: Final Phase 5 Verification, Regression Testing & Scope Freeze.
