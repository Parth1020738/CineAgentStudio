# Phase 4E — Production Planning UI

## Executive Summary

Phase 4E implements the **Production Planning Workspace** in the CineAgent Studio React UI, transforming the application into a digital film production office. The UI surfaces the full multi-agent pre-production intelligence produced by the backend pipeline:
1. **Production Breakdown** (Asset requirements, department dependencies, technical complexity, filters)
2. **Budget Intelligence** (Financial KPIs, category cost allocations, deterministic reconciliation, major cost drivers)
3. **Shooting Schedule** (Day-by-day shooting plan, location clustering, night-block optimization, risk assessment)
4. **Production Insights** (ClickHouse Cloud-backed analytics persisted and queried via standard MCP)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ React Production Planning Workspace (client/src/App.jsx)    │
│ - Primary Tabs: Story | Screenplay | Production Planning    │
│ - Sub-Views: Breakdown | Budget | Schedule | Insights       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP (JSON API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Node Gateway (`server/index.js`)                            │
│ - POST /api/pipeline/production-plan                        │
│ - GET  /api/pipeline/production-insights/:projectId         │
│ - Zero credentials or raw SQL exposed to browser            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Multi-Agent Production Pipeline (`pipeline.js`)             │
│ Story Agent ➔ Screenplay Agent ➔ Breakdown Agent ➔          │
│ Budget Agent ➔ Schedule Agent                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Production Analytics Service (`productionAnalytics.js`)     │
│ Ingests scene metrics, budgets, categories & drivers        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Model Context Protocol (MCP) Runtime (`clickhouseMcp.js`)   │
│ Official `mcp-clickhouse` server via stdio transport        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ClickHouse Cloud Database                                   │
│ Tables: `scene_metrics`, `project_budgets`,                 │
│         `budget_categories`, `budget_drivers`, `agent_runs` │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Production Planning Components & Views

### A. Breakdown View (`client/src/components/BreakdownView.jsx`)
- **Header & Filters**: Filter chips for `All`, `High Cost (>= $30k)`, `High Complexity`, `Night`, `Exterior`.
- **Scene Cards**:
  - Scene number badge and heading slug (e.g. `SCENE 02 EXT. APEX TOWER TRANSMITTER ROOFTOP - NIGHT`).
  - Complexity badge (`LOW`, `MEDIUM`, `HIGH`) and estimated scene cost.
  - Location, INT/EXT setting, and time of day metadata.
  - Department Asset Breakdown blocks: Cast & Talent, Extras count, Props, Special Equipment, VFX & Practical SFX, Wardrobe & Makeup, Vehicles.
  - Director / Production Notes box.

### B. Budget View (`client/src/components/BudgetView.jsx`)
- **Financial KPI Cards**: Estimated Budget, Target Budget, Budget Status (`UNDER_TARGET`, `AT_TARGET`, `OVER_TARGET`), Variance.
- **Deterministic Budget Reconciliation Panel**:
  $$\text{Scene-Linked Costs} + \text{Project-Wide Costs} + \text{Contingency} = \text{Estimated Total}$$
  - Traceable financial equation with full explanation rationale.
- **Department Category Allocations**:
  - Horizontal percentage/progress bars for Cast, Crew, Locations, Equipment, Production Design, Wardrobe/Makeup, Transport, VFX/SFX, Props, Contingency.
- **Major Cost Drivers & Recommendations**:
  - High-impact fiscal factors with monetary impact and explanatory notes.
  - Producer optimization recommendations and budget assumptions.

### C. Schedule View (`client/src/components/ScheduleView.jsx`)
- **Optimization Summary**: Total shoot days, consolidated locations count, night shooting blocks, company moves, optimization strategy notes.
- **Day-by-Day Shooting Schedule Grid**:
  - Shooting day number and date label.
  - Location badge & time-of-day indicator (`NIGHT` / `DAY`).
  - Allocated scene numbers (e.g. `Scene 1, Scene 2`).
  - Talent call roster & extras call count.
  - Estimated day cost.
  - Rigging and setup notes.
  - Director production rationale.
  - Operational risk tags with safety mitigations.
- **Scheduling Parameters & Assumptions**.

### D. Production Insights View (`client/src/components/ProductionInsightsView.jsx`)
- **ClickHouse MCP Live Status Indicator**: `● ClickHouse Cloud Production Analytics (Live Synced via MCP)`.
- **Summary Metrics**: Target budget, estimated total, budget status, variance, scene count, location count, total direct scene costs.
- **Analytics Views (Direct from ClickHouse MCP Queries)**:
  1. *Highest Cost Scenes*: Ranked table of scenes by budget impact.
  2. *Cost by Location*: Location aggregation with scene counts and averages.
  3. *Complexity Distribution*: LOW / MEDIUM / HIGH counts, percentages, and total costs.
  4. *Cast Load by Scene*: Actors, extras, and assigned shooting day.
  5. *Major Cost Drivers*: Highest-impact financial drivers ingested in ClickHouse.

---

## 3. Node Gateway API Contract

### `POST /api/pipeline/production-plan`
- **Request Body**:
  ```json
  {
    "title": "Neon Horizon",
    "genre": "Sci-Fi Cyberpunk",
    "logline": "A rogue AI hunted by its creator uncovers a city-wide conspiracy.",
    "tone": "Neo-Noir",
    "targetBudget": "5000000",
    "targetShootDays": 3,
    "projectId": "optional_custom_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "projectId": "...",
      "title": "...",
      "storyPackage": {...},
      "screenplay": {...},
      "breakdown": {...},
      "budget": {...},
      "schedule": {...},
      "productionInsights": {
        "summary": {...},
        "highestCostScenes": [...],
        "costByLocation": [...],
        "costByCategory": [...],
        "complexityDistribution": [...],
        "castLoadByScene": [...],
        "majorCostDrivers": [...],
        "clickHouseConnected": true
      },
      "pipelineTelemetry": {...}
    }
  }
  ```

---

## 4. Error Handling & Resilience

- **Empty / Partial States**: If analytics are temporarily processing or disconnected, the UI displays `Production Plan Ready (Analytics temporarily unavailable)` without disrupting access to the Story, Screenplay, Breakdown, Budget, or Schedule.
- **Intake Form Validation**: Client-side and server-side validation checks ensure non-empty Title, Genre, and Logline before executing multi-agent pipelines.
- **Pipeline Stage Indicators**: Clear visual progress steps reflecting real backend agent transitions.

---

## 5. Security & Isolation Audit

- **Zero Credentials in Browser**: `GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`, and MCP configuration reside exclusively on the server.
- **Zero Raw SQL in Frontend**: All database operations are encapsulated in server services; frontend receives pure structured JSON.
- **No Private Model Reasoning**: Intermediate chain-of-thought traces are stripped; only validated schema outputs are returned.

---

## 6. Verification Status

- **Unit Test Suite**: 120 passing unit tests (Phase 1 through Phase 4E).
- **Production Build**: Frontend builds cleanly with Vite (`npm run build`).
- **Regression**: All previous phases (Phases 1–4D) remain intact and verified.

---

**PHASE 4E = COMPLETE**
