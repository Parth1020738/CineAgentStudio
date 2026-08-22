# Phase 3A — Screenplay Agent Foundation Documentation

## Overview & Purpose

The **Screenplay Agent** is a dedicated AI agent in CineAgent Studio built using **Google ADK** (`@google/adk`) and **Google Gemini** (`gemini-3.6-flash`). Its purpose is to consume structured story packages produced by the Story Agent (or compatible input fixtures) and transform them into concise, formatted, production-ready screenplay drafts containing 2–3 key scenes suitable for film production and hackathon demonstrations.

This implementation represents **Phase 3A Foundation**. It builds directly on top of the verified Phase 2 architecture without modifying or replacing existing MCP runtime components or ClickHouse Cloud integrations.

---

## Technical Specifications

### 1. Model Used
* **Framework**: Google Agent Development Kit (Google ADK v1.6.0)
* **LLM Engine**: Google Gemini (`gemini-3.6-flash`)
* **Runner Environment**: `InMemoryRunner` with explicit session handling (`createSession`)

### 2. Input Contract (`ScreenplayInputSchema`)
The agent accepts a structured input object adhering to the following Zod contract:

```typescript
{
  projectId?: string;
  title: string;
  logline: string;
  genre?: string;
  tone?: string;
  synopsis: string;
  three_act_structure?: {
    act1: string;
    act2: string;
    act3: string;
  };
  characters: Array<{
    name: string;
    role: string;
    description: string;
  }>;
}
```

### 3. Output Contract (`ScreenplayOutputSchema`)
The agent generates output matching the structured Zod screenplay schema:

```typescript
{
  project_id: string;
  title: string;
  scenes: Array<{
    scene_number: number;      // 1-indexed scene number
    scene_heading: string;     // Standard slugline (e.g. "INT. CYBER LAB - NIGHT")
    location: string;          // Setting location
    time: string;              // Time of day (DAY / NIGHT)
    action: string;            // Present-tense visual action description
    dialogue: Array<{
      character: string;       // Speaking character name
      line: string;            // Dialogue text
      parenthetical?: string;  // Optional delivery cue
    }>;
    transition?: string;       // Optional edit transition (e.g. "CUT TO:")
  }>;
}
```

---

## Quality & Formatting Rules

The `screenplayAgent` system instructions enforce strict screenwriting standards:
1. **Standard Sluglines**: Scene headings follow `INT./EXT. LOCATION - TIME` format.
2. **Visual Writing**: Present-tense action blocks describing visual scenery and movement.
3. **Character Continuity**: Strict adherence to character names and traits provided in the input story fixture without inventing unneeded major characters.
4. **Scene Length**: Generates 2 to 3 key scenes targeted for MVP demonstration.
5. **Strict Schema Enforcement**: Rejects malformed JSON and throws Zod validation errors on invalid data structures.

---

## Files Created / Modified

| Action | File Path | Purpose |
|---|---|---|
| **CREATED** | `server/agents/screenplayAgent.js` | Screenplay Agent definition (`LlmAgent`), Zod input/output schemas, and `runScreenplayAgent` execution function. |
| **CREATED** | `docs/PHASE3A_SCREENPLAY_AGENT.md` | Comprehensive Phase 3A architectural and contract documentation. |
| **MODIFIED** | `tests/unit.test.js` | Added 6 unit test cases for valid screenplay, missing fields, invalid scene structure, invalid dialogue structure, empty scenes, and input validation. |
| **MODIFIED** | `tests/integration.test.js` | Added Phase 3A live integration test running `runScreenplayAgent` against Gemini API with a deterministic story fixture. |

---

## Test Verification Summary

### Unit Tests (`tests/unit.test.js`)
* Valid Screenplay Output schema validation (`PASS`)
* Missing required screenplay fields detection (`PASS`)
* Invalid scene structure rejection (`PASS`)
* Invalid dialogue structure rejection (`PASS`)
* Empty scenes array rejection (`PASS`)
* Screenplay input schema validation (`PASS`)

### Integration Tests (`tests/integration.test.js`)
* Live Gemini Screenplay Agent execution with deterministic fixture (`PASS`)
* Schema validation of generated 2-3 scenes screenplay (`PASS`)
* Preservation of Phase 2 tests (Story Agent & ClickHouse MCP runtime) (`PASS`)

---

## Known Limitations & Scope Boundaries

* **Sub-phase Scope Boundary**: Phase 3A covers foundational agent creation, Zod schemas, unit tests, and live Gemini execution only.
* **Not Included in Phase 3A**:
  * Phase 3B: Advanced screenplay formatting refinements.
  * Phase 3C: Automated Story Agent → Screenplay Agent pipeline orchestration.
  * Phase 3D: ClickHouse Screenplay telemetry logging.
  * Phase 3E: React UI screenplay display interface.
  * Phase 3F: End-to-end multi-agent verification.

---

**Status**: `PHASE 3A COMPLETE`
