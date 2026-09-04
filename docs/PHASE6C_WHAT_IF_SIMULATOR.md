# Phase 6C Enhancement 3 — Production What-If Simulator

## Purpose
The Production What-If Simulator is a decision-support tool in CineAgent Studio that empowers producers to explore how changing production constraints (Target Shoot Days, Target Budget) affect a film production plan before committing.

It operates **100% deterministically** from existing validated production data without invoking Gemini LLM API calls or overwriting the canonical production plan.

---

## Architecture & Principles

1. **Zero LLM Overhead (Offline Calculation)**
   - All scenario trade-offs, deltas, and affected scene identifications are calculated deterministically via `server/services/whatIfSimulator.js`.
   - Sliders and input controls make ZERO external Gemini API calls.

2. **Immutable Canonical Baseline**
   - The canonical production plan (`breakdown`, `budget`, `schedule`) remains untouched.
   - Simulations generate a derived `scenario` object.
   - The UI includes a "Reset to Current Plan" button that immediately restores baseline parameters.

3. **No Database Access Expansion**
   - Uses pre-loaded production data; does not create additional ClickHouse tables or issue queries per slider movement.

---

## Supported Scenarios

| Scenario Control | Metric Input | Deterministic Calculations |
| :--- | :--- | :--- |
| **Target Shoot Days** | Positive integer (e.g., 4 days vs 5 days) | Calculates day delta, compression %, scene density changes, affected scene list, company-move pressure, and overtime risks. |
| **Target Budget** | Positive number (e.g., $4,000,000 vs $5,000,000) | Calculates dollar delta, variance %, cost-pressure categories, and flags non-essential categories as potential reduction areas for producer review. |

---

## Data Contract & Schema (`WhatIfScenarioOutputSchema`)

```json
{
  "scenario_id": "scenario_1788528000000_abc12",
  "scenario_type": "shoot_days",
  "baseline": {
    "budget": 5000000,
    "shoot_days": 5,
    "scene_count": 3,
    "location_count": 3,
    "night_scene_count": 2
  },
  "target": {
    "budget": 5000000,
    "shoot_days": 4
  },
  "deltas": {
    "budget_delta": 0,
    "budget_variance_pct": 0,
    "shoot_days_delta": -1,
    "days_compression_pct": 20
  },
  "affected_scenes": [2, 3],
  "affected_locations": ["TEESTA TRESTLE BRIDGE"],
  "cost_pressure_categories": [
    {
      "category": "Equipment",
      "current_cost": 850000,
      "status": "Baseline",
      "note": "Standard allocation"
    }
  ],
  "tradeoffs": [
    "Compressing schedule by 1 day(s) requires combining 2 scene(s) into remaining shooting days."
  ],
  "risks": [
    "Overtime Risk: Longer daily shooting hours increase crew fatigue and potential overtime rates."
  ],
  "assumptions": [
    "Assumes crew overtime capacity is available on remaining 4 shoot day(s)."
  ]
}
```

---

## API Endpoint & Client Integration

- **Endpoint**: `POST /api/production/what-if`
- **Request**: `{ breakdown, budget, schedule, targetShootDays, targetBudget }`
- **Response**: `{ status: "success", data: <validated scenario output> }`
- **Client View**: Integrated into the Production Planning Workspace under the `⚡ What-If Simulator` subnav tab (`WhatIfView.jsx`).

---

## Manual Verification Results

1. **Scenario A (Target Shoot Days Compression)**:
   - Baseline: 5 shoot days -> Target: 4 shoot days.
   - Canonical plan remained 100% unchanged.
   - Identified real affected scenes `[2, 3]` from validated schedule.
   - Zero Gemini LLM requests executed.

2. **Scenario B (Target Budget Reduction)**:
   - Baseline: $5,000,000 -> Target: $4,000,000.
   - Canonical budget remained 100% unchanged.
   - Delta calculated as `-$1,000,000 (-20%)`.
   - Identified non-essential category reduction pressure without fabricating fake savings.

3. **Reset to Baseline**:
   - Clicked "Reset to Current Plan".
   - Restored original target inputs and cleared scenario overrides.
