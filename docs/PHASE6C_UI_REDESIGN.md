# PHASE 6C ENHANCEMENT 4 — CINEAGENT STUDIO UI REDESIGN

## AI FILM PRODUCTION COMMAND CENTER

This document details the Information Architecture, Visual Design, UX Patterns, and Demo-First Design implemented during Phase 6C Enhancement 4 for CineAgent Studio.

---

## 1. Information Architecture & Navigation

CineAgent Studio is structured into a cohesive 7-stage primary lifecycle navigation:

1. **CONCEPT**: Project Intake Desk, Explanatory Value Statement, and Project Overview Dashboard.
2. **STORY**: Story Package Architecture (Logline, Synopsis, 3-Act Structure, Character Roster).
3. **SCREENPLAY**: Formatted Screenplay Output with visible Detail Level indicator badge (`Concise`, `Cinematic`, `Highly Detailed`).
4. **PRODUCTION**: Production Planning Workspace containing sub-navigation across 4 department views:
   - **BREAKDOWN**: Scene-by-Scene Production Breakdown (Scene Elements, Props, VFX, Special Equipment, High-Cost/Complexity Filters).
   - **BUDGET**: Financial Intelligence & Line-Item Budget (Target, Forecast, Variance, Reconciliations, Drivers).
   - **SCHEDULE**: Shooting Schedule Stripboard (Days, Time of Day, Location Move Clustering, Cast Roster).
   - **INSIGHTS**: ClickHouse Cloud Production Analytics (Highest Cost Scenes, Location Costs, Cast Load).
5. **SCRIPT DOCTOR**: AI Editorial Analysis & Screenplay Review (7 Scoring Categories, Strengths, Issues Found, Recommendations).
6. **WHAT-IF**: Production Scenario Simulator (Current vs What-If Target, Trade-offs, Risks, Affected Areas, Assumptions).
7. **EXPORT**: Production Bible & Multi-Format Workspace (ZIP Archive, Documents, Spreadsheets, Raw JSON Data).

---

## 2. Persistent Project Header

When a production plan or draft exists, a persistent Project Header is rendered across all workspace views:

- **Project Identity**: Title, Genre, Tone, Short Logline.
- **Key Production Metrics Bar**:
  - **Budget**: Sourced from line-item estimate / producer cap (e.g., `$5.0M`).
  - **Shoot Days**: Sourced from shooting schedule length (e.g., `3 Days`).
  - **Scenes**: Sourced from breakdown scene count (e.g., `3 Scenes`).
  - **Locations**: Sourced from unique location count (e.g., `4 Locations`).

Values are strictly sourced from active production plan state and never hardcoded or fabricated.

---

## 3. Production Pipeline Visualization

The workspace features a visual Production Pipeline Status indicator:

`CONCEPT ↓ STORY ↓ SCREENPLAY ↓ BREAKDOWN ↓ BUDGET ↓ SCHEDULE ↓ INSIGHTS`

State Indicators:
- `✓ Complete` (Green): Stage outputs generated and validated.
- `● Active / In Progress` (Blue Pulsing): Currently executing agent stage.
- `○ Not Started` (Muted Gray): Pending downstream stage.
- `⚠ Error` (Red Alert): Execution exception or validation failure.

During multi-agent pipeline execution, active agent progress is visually obvious to producers and judges.

---

## 4. Dashboard Overview & Quick Actions

In the `CONCEPT` / Overview workspace, an active plan surfaces 4 primary quick action pathways:

- `[ Review My Script ]`: Navigates directly to Script Doctor advisory pass.
- `[ Explore What-If ]`: Navigates directly to Production What-If Simulator.
- `[ View Production Plan ]`: Navigates directly to Production Breakdown workspace.
- `[ Export Production Bible ]`: Navigates directly to Export workspace.

---

## 5. Script Doctor Presentation

Script Doctor is positioned as a first-class advisory capability:

- **Header**: `SCRIPT DOCTOR — Editorial analysis before production.`
- **Overall Score**: 0–100 weighted index with color-coded status.
- **7 Scoring Categories**: Structure, Pacing, Character Arcs, Dialogue, Conflict & Stakes, Scene Effectiveness, Production Feasibility.
- **Structured Sections**: `STRENGTHS`, `ISSUES FOUND`, `RECOMMENDATIONS`.
- **Primary CTA**: `[ Review My Script ]` (Advisory-only; does not auto-execute on mount or mutate baseline script).

---

## 6. Production What-If Simulator Presentation

Production What-If provides deterministic scenario simulation without mutating canonical plan data:

- **Current Plan**: Baseline Budget, Shoot Days, Scenes, Locations, Night Scenes.
- **What-If Controls**: Target Shoot Days, Target Budget ($).
- **Scenario Comparison Table**: Metric | Current | What-If | Delta & Variance %.
- **Impact Analysis**: Trade-Offs, Risks, Affected Scenes & Locations, Assumptions.
- **State Labeling**: Derived scenario clearly labeled with badge: `Active Scenario View. Canonical production plan remains unchanged.`
- **Primary Action**: `[ Run Simulation ]`, **Secondary**: `[ Reset to Current Plan ]`.

---

## 7. Screenplay Presentation

Screenplay Output provides authentic film script formatting:

- **Typography**: Monospace / Courier formatting for Scene Headings, Action Blocks, Character Names, Parentheticals, and Transitions.
- **Detail Indicator**: Visible badge displaying active Screenplay Detail Level (`Concise`, `Cinematic`, `Highly Detailed`).

---

## 8. Export Workspace Organization

Organizes project deliverables into 4 clear categories:

1. **Production Bible**: Dominant primary CTA button `[ 📥 EXPORT PRODUCTION BIBLE ]` downloading full project `.ZIP` package.
2. **Documents (PDF Format)**: Screenplay PDF, Budget PDF, Schedule PDF.
3. **Spreadsheets (CSV / Excel Format)**: Breakdown CSV, Budget CSV, Schedule CSV.
4. **JSON Data (Raw Payloads)**: Screenplay, Breakdown, Budget, Schedule, and Insights JSON files.

---

## 9. Responsive Design & Accessibility

- **Responsive Layout**: Flexbox and CSS Grid containers with `minmax()` breakpoints preventing horizontal scroll on mobile, tablet, and desktop (1920x1080).
- **Accessibility**:
  - Semantic HTML5 headings (`<h1>` to `<h4>`).
  - Unique element IDs and explicit `aria-label` attributes across all cards, navigation bars, and form controls.
  - Keyboard focus states and `aria-live="polite"` status announcements for async actions.
  - Zero exposure of API keys, ClickHouse passwords, stack traces, or internal prompts.

---

## 10. Hackathon Demo-First Design

Optimized for a 3-minute hackathon demonstration where judges immediately understand:

*"CineAgent Studio converts a creative idea into a complete production plan, critiques the screenplay, lets the producer explore what-if scenarios, and exports the result."*
