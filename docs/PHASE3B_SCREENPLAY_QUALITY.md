# Phase 3B — Screenplay Format & Quality Validation Documentation

## Overview & Objectives

**Phase 3B** builds directly on top of the foundational Screenplay Agent created in Phase 3A. Its objective is to refine and enforce strict **Screenplay Format & Quality Validation Rules** to guarantee that generated screenplay outputs are not merely syntactically valid JSON, but are structurally, semantically, and visually ready for production in the CineAgent Studio MVP.

This phase introduces strict Zod schema refinements (`ScreenplayOutputSchema`), 17 comprehensive unit test cases, and enhanced live Gemini integration assertions.

---

## Screenplay Format & Quality Validation Rules

### 1. Scene Count Rules
* **Minimum**: 2 scenes
* **Maximum**: 3 scenes
* **Validation**: `scenes.min(2).max(3)`
* **Enforcement**: Screenplay outputs containing 0, 1, or 4+ scenes are rejected.

### 2. Scene Heading (Slugline) Rules
* **Format**: Must begin with standard screenplay prefixes: `INT.`, `EXT.`, or `INT./EXT.` (case-insensitive).
* **Regex Pattern**: `/^(INT|EXT|INT\.\/EXT)\./i`
* **Enforcement**: Generic headings such as `"Scene 1"`, `"Location"`, `""`, or `null` fail validation.

### 3. Scene Numbering Rules
* **Sequential Indexing**: Scene numbers must be positive integers starting from `1` and incrementing sequentially (`1, 2, 3`).
* **Uniqueness**: Duplicate scene numbers (e.g., `1, 1`) fail validation.
* **SuperRefine Check**: Validates `scenes[i].scene_number === i + 1`.

### 4. Location & Time Rules
* **Requirement**: Every scene must contain explicit, non-empty `location` and `time` fields corresponding directly to the slugline.

### 5. Action Quality Rules
* **Requirement**: Present-tense, visual action descriptions.
* **Enforcement**: Non-empty string (`action.min(1)`). Abstract or empty action statements fail validation.

### 6. Dialogue Quality Rules
* **Requirement**: Non-empty `character` and `line` strings.
* **Flexibility**: Scenes with empty dialogue arrays (`dialogue: []`) are permitted for action-only sequences.

### 7. Continuity & Character Rules
* **Consistency**: System prompt instructs Gemini to use character names, roles, and descriptions directly from the input story package without inventing unneeded major characters.

---

## Files Created / Modified

| Action | File Path | Purpose |
|---|---|---|
| **MODIFIED** | `server/agents/screenplayAgent.js` | Refined Zod schemas with regex slugline validation, 2-3 scene count bounds, sequential 1-based scene numbering `superRefine`, and updated prompt instructions. |
| **MODIFIED** | `tests/unit.test.js` | Expanded unit tests with 17 dedicated Phase 3B quality test cases covering scene counts, sluglines, scene numbering, empty fields, and input contracts. |
| **MODIFIED** | `tests/integration.test.js` | Updated live Gemini integration test with Phase 3B quality assertions (2-3 scenes, slugline regex, non-empty actions, valid dialogue). |
| **CREATED** | `docs/PHASE3B_SCREENPLAY_QUALITY.md` | Phase 3B format and quality validation documentation. |

---

## Test Verification Summary

### Unit Tests (`tests/unit.test.js`) — 17 Quality Test Cases
1. Valid 2-scene screenplay (`PASS`)
2. Valid 3-scene screenplay (`PASS`)
3. Zero scenes → FAIL (`PASS`)
4. One scene → FAIL (`PASS`)
5. Four scenes → FAIL (`PASS`)
6. Invalid scene heading (without `INT.`/`EXT.`) → FAIL (`PASS`)
7. Missing location → FAIL (`PASS`)
8. Missing time → FAIL (`PASS`)
9. Empty action → FAIL (`PASS`)
10. Missing dialogue character → FAIL (`PASS`)
11. Missing dialogue line → FAIL (`PASS`)
12. Duplicate scene number → FAIL (`PASS`)
13. Non-sequential scene numbers → FAIL (`PASS`)
14. Empty title → FAIL (`PASS`)
15. Character consistency input validation → FAIL (`PASS`)
16. Valid action-only scene → PASS (`PASS`)
17. Valid scene with dialogue → PASS (`PASS`)

### Integration Tests (`tests/integration.test.js`)
* Live Gemini Screenplay Agent execution with deterministic fixture: `PASS`
* Phase 3B quality rules assertions against live Gemini output: `PASS`
* Phase 2 regression protection (Story Agent & ClickHouse MCP runtime): `PASS`

---

## Known Limitations & Strict Scope Boundary

* **Phase 3B Boundary**: Focuses solely on Screenplay format & quality validation rules, schemas, unit tests, and live Gemini assertions.
* **Deferred Sub-phases (NOT included in Phase 3B)**:
  * Phase 3C: Production Story Agent → Screenplay Agent pipeline connection.
  * Phase 3D: ClickHouse Screenplay telemetry logging.
  * Phase 3E: React UI screenplay view component.
  * Phase 3F: End-to-end multi-agent verification.

---

**Status**: `PHASE 3B COMPLETE`
