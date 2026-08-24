# Phase 4C — ClickHouse Production Analytics

## Executive Summary

Phase 4C establishes ClickHouse Cloud as the primary production analytics engine for CineAgent Studio. 

All production breakdown and budget intelligence produced by upstream agents (Story Agent, Screenplay Agent, Production Breakdown Agent, Budget Agent) are persisted to and queried from ClickHouse Cloud strictly through the official Model Context Protocol (MCP) runtime (`@modelcontextprotocol/sdk` → `mcp-clickhouse` → ClickHouse Cloud).

---

## 1. Architecture Diagram

```
┌──────────────────────────────────────────────┐
│ Production Breakdown Agent & Budget Agent    │
│ (Real Agent Outputs & Hardened Schema)       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Production Analytics Service                 │
│ (`server/services/productionAnalytics.js`)   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Model Context Protocol (MCP) Runtime         │
│ - @modelcontextprotocol/sdk Client           │
│ - official mcp-clickhouse (run_query)        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ ClickHouse Cloud                             │
│ - scene_metrics                              │
│ - project_budgets                            │
│ - budget_categories                          │
│ - budget_drivers                             │
│ - agent_runs                                 │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Analytics Query Functions (MCP SQL Reads)    │
│ - getProjectProductionSummary                │
│ - getHighestCostScenes                       │
│ - getCostByLocation                          │
│ - getCostByCategory                          │
│ - getComplexityDistribution                  │
│ - getCastLoadByScene                         │
│ - getMajorCostDrivers                        │
└──────────────────────────────────────────────┘
```

---

## 2. Production Analytics Data Model & ClickHouse Tables

### 1. `scene_metrics` (Extended)
Tracks scene-level production parameters and costs:
```sql
CREATE TABLE IF NOT EXISTS scene_metrics (
    project_id String,
    scene_id String,
    scene_number UInt16,
    scene_heading String,
    location String,
    interior_exterior String,
    time_of_day String,
    cast_count UInt16,
    extras_count UInt16,
    complexity String,
    estimated_cost Float64,
    shooting_day UInt16,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, scene_number)
```

### 2. `project_budgets`
Tracks overall project budget summaries and reconciliation components:
```sql
CREATE TABLE IF NOT EXISTS project_budgets (
    project_id String,
    title String,
    target_budget Float64,
    estimated_total Float64,
    budget_status String,
    budget_variance Float64,
    scene_linked_cost_total Float64,
    project_wide_cost_total Float64,
    contingency_cost Float64,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, created_at)
```

### 3. `budget_categories`
Tracks industry standard budget category line items:
```sql
CREATE TABLE IF NOT EXISTS budget_categories (
    project_id String,
    category String,
    estimated_cost Float64,
    explanation String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, category)
```

### 4. `budget_drivers`
Tracks major cost impact drivers and reasons:
```sql
CREATE TABLE IF NOT EXISTS budget_drivers (
    project_id String,
    factor String,
    impact Float64,
    explanation String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, factor)
```

### 5. `agent_runs`
Tracks telemetry and execution metrics for all pipeline agents:
```sql
CREATE TABLE IF NOT EXISTS agent_runs (
    run_id String,
    project_id String,
    agent_name String,
    status String,
    duration_ms UInt32,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, created_at)
```

---

## 3. Analytics Service & Query Functions (`server/services/productionAnalytics.js`)

1. `ensureProductionAnalyticsSchema()`: Ensures all tables exist via MCP `run_query`.
2. `recordProductionAnalytics({ projectId, title, breakdown, budget })`: Ingests real agent output into all ClickHouse tables.
3. `getProjectProductionSummary(projectId)`: Returns budget total, target, variance, scene count, location count, and total scene costs.
4. `getHighestCostScenes(projectId, limit)`: Returns top scenes sorted by `estimated_cost DESC`.
5. `getCostByLocation(projectId)`: Aggregates total cost and scene count grouped by location.
6. `getCostByCategory(projectId)`: Aggregates budget category costs sorted descending.
7. `getComplexityDistribution(projectId)`: Aggregates scene count by complexity (`LOW`, `MEDIUM`, `HIGH`).
8. `getCastLoadByScene(projectId)`: Returns cast and extras count for each scene.
9. `getMajorCostDrivers(projectId)`: Returns factors and financial impacts for key drivers.

---

## 4. Live Verification Evidence (`analytics_live_demo_1787507115891`)

### Project Summary:
```json
{
  "target_budget": 5000000,
  "estimated_total": 1250000,
  "budget_status": "UNDER_TARGET",
  "budget_variance": -3750000,
  "scene_count": 3,
  "location_count": 3,
  "total_scene_costs": 97500
}
```

### Highest Cost Scenes:
1. `EXT. APEX CITADEL ROOFTOP - NIGHT` (Complexity: `HIGH`): **$52,000**
2. `INT. APEX CITADEL BROADCAST VAULT - NIGHT` (Complexity: `MEDIUM`): **$27,000**
3. `INT. SUBTERRANEAN MAINTENANCE TUNNEL - NIGHT` (Complexity: `MEDIUM`): **$18,500**

### Location Aggregation:
- `APEX CITADEL ROOFTOP`: **$52,000** (1 scene)
- `APEX CITADEL BROADCAST VAULT`: **$27,000** (1 scene)
- `SUBTERRANEAN MAINTENANCE TUNNEL`: **$18,500** (1 scene)

### Complexity Distribution:
- `MEDIUM`: 2 scenes
- `HIGH`: 1 scene

### Major Cost Drivers:
- `Holographic ARIA Avatar & Cityscape VFX`: **$120,000**
- `Night Rooftop Rain Shoot`: **$52,000**

---

## 5. Scope Boundaries

Phase 4C is complete. The following future phases remain unbuilt per prompt constraints:
- **Phase 4D**: Schedule Agent
- **Phase 4E**: Production Planning React UI (Production Breakdown, Budget, Analytics dashboard tabs)
- **Phase 4F**: Final Phase 4 Verification & Freeze

---

**PHASE 4C = COMPLETE**
