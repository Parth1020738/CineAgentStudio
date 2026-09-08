# CineAgent Studio — Demo Evidence & Submission Asset Preparation (Phase 6C-D)

## Overview
This document provides a comprehensive evidence checklist, screenshot framing guide, technical asset inventory, and hackathon submission plan for **CineAgent Studio**. It documents how to showcase the platform's multi-agent AI production pipeline, ClickHouse Cloud analytics via MCP, advisory Script Doctor, Production What-If Simulator, and multi-format Export Workspace clearly and credibly.

---

## 1. Demo Projects
- **Primary Presentation Project**: `The Last Monsoon` (Sci-Fi / Climate Thriller) — Main visual narrative and primary end-to-end evidence source.
- **Secondary Verified Project**: `Echoes Below` (Subterranean Mystery) — Secondary proof of multi-concept generalization across different narrative genres and budgets.

---

## 2. Screenshot Framing & Visual Hygiene Standards

To maintain maximum credibility and executive presentation quality, all screenshots must adhere to the following standards:
- **Resolution**: 1920x1080 (1080p Full HD) standard widescreen ratio where practical.
- **Viewport**: Browser fullscreen or clean application window without browser bookmarks bar, extension icons, or personal tabs.
- **Composition**: Relevant UI card or feature centered with clear margin padding; readable typography.
- **Clean State**: Active production plan loaded; zero error banners or unhandled exceptions.
- **Security & Privacy Guardrails**:
  - **NEVER** expose Gemini API keys (`AIzaSy...`), ClickHouse passwords, MCP tokens, or authorization headers.
  - **NEVER** expose local OS filesystem paths (`C:\Users\...` or `/home/...`).
  - **NEVER** expose personal email addresses, browser bookmarks, or private repository URLs.
  - Keep technical evidence (e.g. MCP logging or terminal output) isolated in separate optional technical figures.

---

## 3. Product Evidence Checklist (10 Essential Product Screenshots)

### 1. Concept / Intake Workspace
- **Screenshot Purpose**: Demonstrates initial project setup, creative prompt entry, detail level configuration, and primary CTA.
- **What Should Be Visible**: Film Title (`The Last Monsoon`), Genre (`Sci-Fi`), Logline, Target Budget (`$5,000,000`), Target Shoot Days (`12`), Screenplay Detail Level selector (`Cinematic`), and `GENERATE PRODUCTION PLAN` primary CTA.
- **Key Feature Demonstrated**: Intake validation, production budget/schedule constraint input, and detail level customization.
- **Recommended Framing**: 1920x1080, centered intake form card with top navigation lifecycle tabs.
- **What Should NOT Be Visible**: API keys, environment variable fields, browser developer tools.
- **Evidence Source**: Live deployment / verified project (`The Last Monsoon`).

### 2. Story Package View
- **Screenshot Purpose**: Displays AI-generated narrative foundation.
- **What Should Be Visible**: Executive Logline, Full Synopsis, 3-Act Structure breakdown (Act I, Act II, Act III), and Character Roster with character bios.
- **Key Feature Demonstrated**: Story Agent narrative generation and structured character roster output.
- **Recommended Framing**: Fullscreen view of `📖 STORY` tab with 3-Act cards and character roster expanded.
- **What Should NOT Be Visible**: Stack traces, unparsed JSON strings, raw prompt text.
- **Evidence Source**: Verified production plan (`The Last Monsoon`).

### 3. Rich Highly-Detailed Screenplay View
- **Screenshot Purpose**: Displays formatted screenplay output adhering to industry standard script typography and formatting.
- **What Should Be Visible**: Courier Prime screenplay paper container, Scene Headings (`INT. WEATHER LAB - DAY`), Action Blocks, Character Cues, Parentheticals, Dialogue, and `Detail Level: Cinematic` indicator badge.
- **Key Feature Demonstrated**: Rich Screenplay Agent generation with custom screenplay detail level support.
- **Recommended Framing**: Centered script paper view inside `📜 SCREENPLAY` tab with clear page styling and subtle drop shadow.
- **What Should NOT Be Visible**: Generic unformatted text, raw JSON payloads.
- **Evidence Source**: Verified production plan (`The Last Monsoon`).

### 4. Production Breakdown View
- **Screenshot Purpose**: Demonstrates scene-by-scene asset extraction, technical complexity tagging, and filtering.
- **What Should Be Visible**: Scene breakdown cards, Scene Headings, Location badges, Day/Night & INT/EXT pills, Character tags, Props, VFX, Special Equipment, Complexity badges (`HIGH`/`MEDIUM`/`LOW`), Scene Estimated Costs, and filter chip bar (`All`, `High Cost`, `High Complexity`, `Night Shoot`, `EXT Shoot`).
- **Key Feature Demonstrated**: Production Breakdown Agent scene extraction and intelligent filtering.
- **Recommended Framing**: `🎬 PRODUCTION` tab -> `Breakdown` sub-tab with filter chips and breakdown cards visible.
- **What Should NOT Be Visible**: Empty asset lists, raw database IDs.
- **Evidence Source**: Verified production plan (`The Last Monsoon`).

### 5. Budget View
- **Screenshot Purpose**: Displays financial line-item breakdown, target budget cap, and exact reconciliation model.
- **What Should Be Visible**: Budget Summary KPI strip (`Estimated Cost`, `Target Budget`, `Variance`, `Status: UNDER_TARGET`), Category Cost Breakdown table, Scene-Linked Costs vs Project-Wide Costs, Major Cost Drivers, and Budget Reconciliation summary (`Scene Total + Project Wide + Contingency = Estimated Total`).
- **Key Feature Demonstrated**: Budget Agent financial breakdown and mathematical reconciliation equality.
- **Recommended Framing**: `🎬 PRODUCTION` tab -> `Budget` sub-tab showing KPI cards and Category Breakdown table.
- **What Should NOT Be Visible**: NaN values, unformatted floating-point decimals (`$12345.6789`).
- **Evidence Source**: Verified production plan (`The Last Monsoon`).

### 6. Shooting Schedule View
- **Screenshot Purpose**: Displays shooting day schedule, location consolidation, and risk analysis.
- **What Should Be Visible**: Total Shoot Days badge, Day-by-Day schedule cards (`Day 1`, `Day 2`), Shooting Locations, Scenes assigned, Talent Cast roster, Setup notes, Rationale for ordering, and Risk mitigation notes.
- **Key Feature Demonstrated**: Schedule Agent location-based grouping and night shoot block consolidation.
- **Recommended Framing**: `🎬 PRODUCTION` tab -> `Schedule` sub-tab showing Day cards and Optimization Summary.
- **What Should NOT Be Visible**: Overlapping day numbers, unassigned scenes.
- **Evidence Source**: Verified production plan (`The Last Monsoon`).

### 7. Production Insights View (ClickHouse Cloud Dashboard)
- **Screenshot Purpose**: Demonstrates real-time production analytics powered by ClickHouse Cloud via MCP.
- **What Should Be Visible**: `PRODUCTION INSIGHTS` header, `ClickHouse Cloud Production Analytics` status strip with `Live Synced via MCP` / `LOCAL DEMO DATA` badge, Project Summary KPIs, Cost Analysis cards (`Highest-Cost Scenes`, `Cost by Location`), Production Complexity distribution, Cast & Extras load, and Major Cost Drivers table.
- **Key Feature Demonstrated**: Real-time ClickHouse Cloud analytics persistence and multi-perspective queries via MCP.
- **Recommended Framing**: `🎬 PRODUCTION` tab -> `Insights` sub-tab showing spacious card layout and aligned data tables.
- **What Should NOT Be Visible**: Raw ClickHouse SQL queries, database passwords, connection timeouts.
- **Evidence Source**: Verified production plan (`The Last Monsoon` / ClickHouse Cloud MCP).

### 8. Script Doctor View
- **Screenshot Purpose**: Displays automated narrative analysis and quality scoring.
- **What Should Be Visible**: `SCRIPT DOCTOR` header, `Overall Score` gauge badge (e.g. `85 / 100`), 7 Category Score cards (`Pacing & Structure`, `Dialogue Quality`, `Character Arc Clarity`, `Visual Storytelling`, `Production Feasibility`, `Genre Alignment`, `Commercial Potential`), Strengths list, and Targeted Recommendations list.
- **Key Feature Demonstrated**: Script Doctor Agent non-destructive script evaluation and scoring.
- **Recommended Framing**: `🩺 SCRIPT DOCTOR` tab with overall score banner and category grid visible.
- **What Should NOT Be Visible**: Code modifications, edit input boxes (Script Doctor is advisory and non-destructive).
- **Evidence Source**: Verified screenplay review (`The Last Monsoon`).

### 9. Production What-If Simulator View
- **Screenshot Purpose**: Demonstrates interactive scenario modeling and cost/schedule trade-off simulation.
- **What Should Be Visible**: `WHAT-IF SIMULATOR` header, Interactive Controls (`Target Budget` slider/number input, `Target Shoot Days` slider/number input, `Reset to Current Plan` button), Baseline vs Scenario Comparison card, Delta calculations (`Cost Delta`, `Schedule Delta`, `Variance %`), Affected Scenes breakdown, and Trade-Off Analysis rationale.
- **Key Feature Demonstrated**: What-If Simulator offline deterministic recalculation and trade-off modeling without LLM quota consumption.
- **Recommended Framing**: `⚡ WHAT-IF` tab with baseline vs scenario card and interactive controls visible.
- **What Should NOT Be Visible**: Unhandled division by zero, mutated canonical plan data.
- **Evidence Source**: Verified simulation (`The Last Monsoon`).

### 10. Export Workspace / Production Bible
- **Screenshot Purpose**: Displays multi-format document and spreadsheet generation options.
- **What Should Be Visible**: `EXPORT WORKSPACE` header, Primary CTA `EXPORT PRODUCTION BIBLE (ZIP)`, Format Cards grouped into Documents (PDF Screenplay, PDF Budget, PDF Schedule), Spreadsheets (CSV Breakdown, CSV Budget, CSV Schedule), and JSON Data (Raw Production Plan), and download progress indicator.
- **Key Feature Demonstrated**: Multi-format export engine, client-side Blob stream download handling, and Production Bible ZIP packaging.
- **Recommended Framing**: `📦 EXPORT` tab centered view showing Production Bible CTA and format card grid.
- **What Should NOT Be Visible**: Server directory paths, un-sanitized internal token properties.
- **Evidence Source**: Verified export workspace (`The Last Monsoon`).

---

## 4. Optional Technical Evidence Screenshots (5 Technical Figures)

1. **ClickHouse MCP Telemetry Connection**:
   - **Purpose**: Demonstrates live MCP stdio/SSE protocol connection to official `mcp-clickhouse` server.
   - **What Should Be Visible**: Telemetry card footer showing `Pipeline Status: SUCCESS`, `ClickHouse MCP Telemetry: CONNECTED / SYNCED` (or `PERSISTED ✅`), and total duration in ms.

2. **Multi-Agent Pipeline Telemetry Summary**:
   - **Purpose**: Demonstrates multi-agent step timing and execution metrics.
   - **What Should Be Visible**: Execution duration breakdown (`totalDurationMs`), project ID tag, and status badge.

3. **Render Cloud Service Live Deployment**:
   - **Purpose**: Demonstrates public cloud deployment on Render Free Web Service.
   - **What Should Be Visible**: Public HTTPS URL endpoint (`https://...onrender.com`), `/health` response returning `{"status":"ok"}`.

4. **Production Bible ZIP File Contents**:
   - **Purpose**: Demonstrates generated archive contents.
   - **What Should Be Visible**: Extracted ZIP archive containing PDF documents (`Screenplay.pdf`, `Budget.pdf`, `Schedule.pdf`), CSV spreadsheets (`Breakdown.csv`, `Budget.csv`, `Schedule.csv`), and `ProductionPlan.json`.

5. **Multi-Concept Verification (`Echoes Below`)**:
   - **Purpose**: Proves system operates deterministically across multiple distinct film concepts.
   - **What Should Be Visible**: Story Package & Production Breakdown for secondary film concept `Echoes Below`.

---

## 5. Recommended Narrative Submission Flow & Screenshot Order

For optimal storyline presentation on Devpost and submission galleries:

```
[1. Concept / Intake]
         │
         ▼
[2. Story Package]
         │
         ▼
[3. Rich Screenplay]
         │
         ▼
[4. Production Breakdown]
         │
         ▼
[5. Budget & Schedule]
         │
         ▼
[6. ClickHouse Insights]
         │
         ▼
[7. Script Doctor]
         │
         ▼
[8. What-If Simulator]
         │
         ▼
[9. Export Workspace]
```

### Essential vs. Optional Asset Classification
- **Essential Assets (10 Product Screenshots + 1 Video)**: Form the core visual presentation of the product features.
- **Optional Assets (5 Technical Figures)**: Provide supporting evidence for hackathon judges inspecting technical architecture (ClickHouse MCP, Render, ZIP exports).

---

## 6. Submission Asset Inventory

| Asset Name | Purpose | Source | Status |
|---|---|---|---|
| **Demo Video (3-min)** | Primary product video walk-through | Recorded walkthrough video | **READY** |
| **01_Concept_Intake.png** | Form intake & constraint inputs | Live Deployment / Verified Plan | Ready for Capture |
| **02_Story_Package.png** | 3-Act structure & character roster | Live Deployment / Verified Plan | Ready for Capture |
| **03_Rich_Screenplay.png** | Cinematic script paper formatting | Live Deployment / Verified Plan | Ready for Capture |
| **04_Production_Breakdown.png**| Scene assets & category filtering | Live Deployment / Verified Plan | Ready for Capture |
| **05_Budget_Reconciliation.png**| Line-item costs & budget cap | Live Deployment / Verified Plan | Ready for Capture |
| **06_Shooting_Schedule.png** | Day-by-Day schedule & risks | Live Deployment / Verified Plan | Ready for Capture |
| **07_ClickHouse_Insights.png**| Analytics dashboard via MCP | Live Deployment / ClickHouse Cloud | Ready for Capture |
| **08_Script_Doctor.png** | Advisory narrative score cards | Live Deployment / Verified Plan | Ready for Capture |
| **09_WhatIf_Simulator.png** | Scenario modeling & trade-offs | Live Deployment / Verified Plan | Ready for Capture |
| **10_Export_Workspace.png** | Multi-format Bible ZIP export | Live Deployment / Verified Plan | Ready for Capture |
| **Tech_01_ClickHouse_MCP.png** | MCP telemetry & connection status | Technical Log / UI Footer | Optional / Ready |
| **Tech_02_Render_Deploy.png** | Public HTTPS deployment proof | Render Dashboard / `/health` | Optional / Ready |
| **Tech_03_Bible_Archive.png** | ZIP archive file bundle proof | File System / Extracted Zip | Optional / Ready |

---

## 7. Demo Video Recommendations

- **Primary Asset**: The completed 3-minute video recording is the canonical video asset for submission.
- **Title**: `CineAgent Studio — Autonomous Multi-Agent AI Film Production Studio`
- **Intended Placement**: Top of Devpost project submission page & YouTube unlisted/public link.
- **Approximate Duration**: ~3 minutes.
- **Narrative Structure**:
  1. *0:00 - 0:30*: Problem statement & Concept Intake (`The Last Monsoon`).
  2. *0:30 - 1:15*: Multi-Agent Generation (Story, Screenplay, Breakdown, Budget, Schedule).
  3. *1:15 - 1:55*: ClickHouse Cloud Analytics via MCP & Script Doctor Review.
  4. *1:55 - 2:35*: Interactive Production What-If Simulator & Export Workspace.
  5. *2:35 - 3:00*: Public Render Deployment & Summary.

---

## 8. Final Security Audit & Confirmation

- **No Code Modifications**: Zero source files modified during asset preparation.
- **No Deployment Execution**: Zero cloud deployments or GitHub pushes executed.
- **Secret Safety**: Confirmed no API keys, ClickHouse passwords, or MCP tokens are visible in UI or asset documentation.
