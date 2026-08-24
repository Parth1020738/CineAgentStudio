# Phase 4A — Production Breakdown Agent

## Executive Summary

Phase 4A introduces the first Production Intelligence agent for CineAgent Studio: the **Production Breakdown Agent** (`server/agents/breakdownAgent.js`).

The Breakdown Agent consumes a **validated Screenplay Output** (from Screenplay Agent) and transforms it into a detailed, scene-by-scene production breakdown containing location, interior/exterior tag, time of day, cast roster, extras count, props, vehicles, wardrobe, makeup FX, special equipment, special effects, VFX, production complexity, scene cost estimate, and technical production notes.

---

## 1. Integration Architecture

```
┌─────────────────────────────────────────┐
│ Validated Screenplay Output             │
│ (ScreenplayOutputSchema: title, scenes) │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ Production Breakdown Agent               │
│ - Google ADK (LlmAgent)                 │
│ - Google Gemini 3.6 Flash               │
│ - BreakdownInputSchema                  │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ ProductionBreakdownSchema (Zod)         │
│ - Scene-by-scene breakdown              │
│ - Production complexity & cost estimates│
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ Screenplay Fidelity Validation          │
│ (`validateBreakdownFidelity`)           │
│ - Scene count & number alignment        │
│ - Heading & location alignment          │
└─────────────────────────────────────────┘
```

---

## 2. Input & Output Contracts

### Input Contract (`BreakdownInputSchema`):
```typescript
{
  project_id: string; // Non-empty string matching screenplay project_id
  title: string;      // Non-empty film title matching screenplay title
  screenplay: {       // Validated ScreenplayOutputSchema object
    project_id: string;
    title: string;
    scenes: Array<{
      scene_number: number;
      scene_heading: string;
      location: string;
      time: string;
      action: string;
      dialogue: Array<{ character: string; line: string; parenthetical?: string }>;
      transition?: string;
    }>;
  };
}
```

### Output Contract (`ProductionBreakdownSchema`):
```typescript
{
  project_id: string;
  title: string;
  scenes: Array<{
    scene_number: number;
    scene_heading: string;
    location: string;
    interior_exterior: 'INT' | 'EXT' | 'INT/EXT';
    time_of_day: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'OTHER';
    characters: string[];
    extras_count: number; // >= 0
    props: string[];
    vehicles: string[];
    wardrobe: string[];
    makeup_fx: string[];
    special_equipment: string[];
    special_effects: string[];
    vfx: string[];
    production_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    estimated_cost: number; // >= 0 USD
    production_notes: string;
  }>;
}
```

---

## 3. Field Definitions & Production Rules

- **`interior_exterior`**: Derived directly from the scene heading prefix (`INT.`, `EXT.`, `INT./EXT.`).
- **`time_of_day`**: Derived from scene heading suffix (`DAY`, `NIGHT`, `DAWN`, `DUSK`, or `OTHER`).
- **`characters`**: List of character names present in dialogue or action blocks for the scene.
- **`extras_count`**: Integer representing crowd/background actors required.
- **`props` / `vehicles` / `wardrobe`**: Extracted directly from visual action descriptions and character dialogue.
- **`special_effects` / `vfx` / `special_equipment`**: Extracted based on environmental factors (e.g. rain, explosions, holographic projections, camera rigs).
- **`production_complexity`**:
  - `LOW`: Simple interior dialague, small cast (1-2), no vehicles or special effects.
  - `MEDIUM`: Multiple cast members, daytime exterior, basic props/wardrobe, standard stunt or vehicle.
  - `HIGH`: Night shoots, rain machines, stunt work, heavy VFX/CGI, large crowd/extras.
- **`estimated_cost`**: Preliminary USD scene production cost estimate based on complexity and requirements.
- **`production_notes`**: Concise technical rationale for logistics, lighting, sound, or safety hazards.

---

## 4. Screenplay Fidelity & Continuity Rules

The validation function `validateBreakdownFidelity(screenplay, breakdown)` enforces:
1. `breakdown.project_id` must match `screenplay.project_id`.
2. `breakdown.title` must match `screenplay.title`.
3. `breakdown.scenes.length` must exactly match `screenplay.scenes.length`.
4. For each scene index `i`:
   - `bd.scene_number === sc.scene_number`
   - `bd.scene_heading === sc.scene_heading`
   - `bd.location` must align with `sc.location`

---

## 5. Test Suite Verification

### Unit Tests (`npx mocha tests/unit.test.js`):
- **15 unit tests** added specifically for Phase 4A covering:
  1. Valid production breakdown
  2. Missing `project_id`
  3. Missing `title`
  4. Empty `scenes` array
  5. Scene count mismatch
  6. Scene number mismatch
  7. Scene heading mismatch
  8. Invalid `interior_exterior` enum
  9. Invalid `time_of_day` enum
  10. Negative `extras_count`
  11. Negative `estimated_cost`
  12. Invalid `production_complexity` enum
  13. Missing required production notes
  14. Character alignment check
  15. Location alignment check

### Integration & Live Tests (`npm test`):
- Total tests: **63 passing, 0 failing, 0 skipped**.
- Live Breakdown Agent test against Gemini 3.6 Flash verified schema parsing and fidelity checks.
- Full 3-agent pipeline (`runFullProductionPipeline`) tested end-to-end (Story Agent -> Screenplay Agent -> Breakdown Agent).

---

## 6. Scope Freeze & Next Phases

Phase 4A is complete. The following future phases remain deferred and unbuilt:
- **Phase 4B**: Budget Agent
- **Phase 4C**: ClickHouse Production Analytics
- **Phase 4D**: Schedule Agent
- **Phase 4E**: Production Planning UI
- **Phase 4F**: Final Phase 4 Verification & Freeze

---

**PHASE 4A = COMPLETE**
