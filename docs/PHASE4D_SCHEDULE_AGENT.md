# Phase 4D — Schedule Agent

## Executive Summary

Phase 4D completes the Production Intelligence trifecta for CineAgent Studio by introducing the **Schedule Agent** (`server/agents/scheduleAgent.js`).

The Schedule Agent consumes the **validated Production Breakdown** (Phase 4A) and **validated Budget** (Phase 4B) to generate a realistic, cost-conscious, and production-optimized **Shooting Schedule**. It groups scenes by location and time-of-day blocks (e.g. continuous night shoots), balances cast and crew call loads, respects specialized equipment and stunt/VFX setups, and provides concise production rationales and risk assessments for each shooting day.

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Validated Production Breakdown + Validated Budget           │
│ (ProductionBreakdownSchema & BudgetOutputSchema)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Schedule Agent                                              │
│ - Google ADK (LlmAgent)                                     │
│ - Google Gemini 3.6 Flash                                   │
│ - ScheduleInputSchema                                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ScheduleOutputSchema (Zod)                                  │
│ - Day-by-day plan (shooting_day, scenes, location, cast)    │
│ - Setup notes, production rationale, & risk assessment      │
│ - Optimization summary & assumptions                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Strict Schedule Fidelity Validation                         │
│ (`validateScheduleFidelity`)                                │
│ - Screenplay scenes == Breakdown scenes == Scheduled scenes │
│ - Exact coverage (no missing, no duplicate scene assignment)│
│ - Sequential day numbering (Day 1..N)                       │
│ - Location & time-of-day fidelity                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ClickHouse Cloud Persistence via MCP                        │
│ - Persists `shooting_day` to `scene_metrics` table          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Input & Output Contracts

### Input Contract (`ScheduleInputSchema`):
```typescript
{
  project_id: string;
  title: string;
  target_shoot_days?: number | null;
  production_breakdown: ProductionBreakdownSchema;
  budget?: BudgetOutputSchema | null;
}
```

### Output Contract (`ScheduleOutputSchema`):
```typescript
{
  project_id: string;
  title: string;
  total_shoot_days: number;
  days: Array<{
    shooting_day: number;
    date_label: string;
    location: string;
    time_of_day: string;
    scenes: number[];
    cast: string[];
    extras_count: number;
    estimated_day_cost: number;
    setup_notes: string;
    rationale: string;
    risks: string[];
  }>;
  optimization_summary: {
    locations_consolidated: number;
    night_blocks: number;
    estimated_location_moves: number;
    estimated_shoot_days: number;
    scheduling_notes: string;
  };
  assumptions: string[];
}
```

---

## 3. Production Scheduling & Optimization Rules

1. **Location Consolidation**: Scenes sharing identical or adjacent locations are grouped into single shooting days or consecutive blocks to avoid redundant company moves.
2. **Night Block Optimization**: Night scenes are clustered into continuous night shooting blocks to prevent costly turnaround schedule flips.
3. **Cast Load Efficiency**: Days are structured to minimize idle hold days for principal actors.
4. **Special Setup & Rig Grouping**: Complex setups (e.g. rain machines, safety rigging, pyrotechnics) are isolated to dedicated production days.
5. **Exact Scene Coverage**: Every scene from the Breakdown must appear in `schedule.days` exactly once.

---

## 4. Live Verification Evidence (`schedule_live_demo_1787509220970`)

- **Screenplay Scenes**: 3
- **Breakdown Scenes**: 3
- **Scheduled Scenes**: 3 (Exact 1:1:1 Match)
- **Total Shoot Days**: 3

### Day-by-Day Shooting Schedule:
- **Day 1 (Night)**: `SEWER SYSTEM` (Scene 1)
  - Cast: `Silas`, `ARIA` (Extras: 0)
  - Estimated Cost: **$18,500**
  - Setup: Subterranean fog machine, water drip practical SFX, low-light camera package.
  - Rationale: Establish subterranean mood and isolation in a controlled interior night location.
  - Risks: `["Damp working conditions", "Ventilation for fog SFX"]`
- **Day 2 (Night)**: `APEX TOWER TRANSMITTER ROOFTOP` (Scene 2)
  - Cast: `Silas`, `Vance` (Extras: 2)
  - Estimated Cost: **$52,000**
  - Setup: Torrential rain machines, safety harness rigging, wet-down lighting, night crane.
  - Rationale: Dedicated night shoot for high-risk rooftop stunt action with heavy weather effects.
  - Risks: `["Rooftop fall hazard", "Equipment water damage", "Cold exposure for cast/crew"]`
- **Day 3 (Night)**: `APEX BROADCAST CENTER` (Scene 3)
  - Cast: `Silas`, `ARIA` (Extras: 0)
  - Estimated Cost: **$27,000**
  - Setup: Control room set, multi-screen playback monitors, pyrotechnic spark rigs.
  - Rationale: Conclude production in controlled interior studio space for the climactic broadcast confrontation.
  - Risks: `["Pyrotechnic spark safety", "Monitor display sync issues"]`

### ClickHouse Shooting Day Persistence:
Queried `scene_metrics` in ClickHouse Cloud via official `mcp-clickhouse` `run_query`:
- Scene 1 → `shooting_day: 1`
- Scene 2 → `shooting_day: 2`
- Scene 3 → `shooting_day: 3`

---

## 5. Test Suite Verification

- **Unit Tests (`npx mocha tests/unit.test.js`)**: **109 passing, 0 failing** (20 Phase 4D specific unit tests).
- **Live 5-Agent E2E Pipeline**: Verified end-to-end with real Story Agent → Screenplay Agent → Breakdown Agent → Budget Agent → Schedule Agent → ClickHouse MCP persistence.

---

## 6. Scope Boundaries

Phase 4D is complete. The following future phases remain unbuilt per prompt constraints:
- **Phase 4E**: Production Planning React UI (Breakdown, Budget, Schedule, and Analytics tabs)
- **Phase 4F**: Final Phase 4 Verification & Freeze

---

**PHASE 4D = COMPLETE**
