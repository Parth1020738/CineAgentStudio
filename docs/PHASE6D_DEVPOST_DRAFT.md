# CineAgent Studio — Devpost Hackathon Submission Draft

> **CineAgent Studio is not just an AI screenplay generator. It is an AI-assisted film production decision system.**

---

## 1. Project Title
**CineAgent Studio** — Autonomous Multi-Agent AI Film Pre-Production & Planning Platform

---

## 2. One-Line Pitch
An autonomous multi-agent AI system powered by Google ADK, Gemini, and ClickHouse Cloud via MCP that transforms movie concepts into complete, costed, and scheduled film production packages.

---

## 3. The Problem
Bringing a feature film or indie project from logline to principal photography is one of the most fragmented and expensive phases in filmmaking. 

Traditionally, moving from a script idea to actual production planning requires weeks of manual effort across disconnected silos:
- Screenwriters format scripts manually.
- Line producers spend days manually marking up scripts to extract cast, props, VFX, and locations.
- Production managers manually construct shooting schedules to group locations and minimize costly unit moves.
- Accountants balance complex line-item budgets while attempting to account for scene-level cost drivers.

Independent filmmakers and production studios face high financial risks, unexpected cost overruns, and scheduling bottlenecks before a single camera rolls. Existing AI tools only generate text scripts without any understanding of real-world production logistics, financial constraints, or scheduling feasibility.

---

## 4. The Solution
**CineAgent Studio** solves this by unifying creative narrative generation with deterministic film production engineering. 

Given a simple movie logline, genre, target budget, and target shoot duration, CineAgent Studio orchestrates a pipeline of specialized AI agents to generate a complete **Production Package**:

```
[Concept & Constraints]
         │
         ▼
[1. Story Agent] ────────► Narrative Architecture & 3-Act Structure
         │
         ▼
[2. Screenplay Agent] ───► Formatted Industry Script (Concise / Cinematic / Detailed)
         │
         ▼
[3. Breakdown Agent] ────► Scene-by-Scene Asset & Technical Extraction
         │
         ▼
[4. Budget Agent] ───────► Line-Item Financial Allocation & Math Reconciliation
         │
         ▼
[5. Schedule Agent] ─────► Location-Consolidated Shooting Day Plan
         │
         ├───► [ClickHouse Cloud MCP] ──► Real-Time Telemetry & Production Analytics
         ├───► [Script Doctor] ─────────► Advisory Non-Destructive Script Review
         ├───► [What-If Simulator] ─────► Interactive Budget/Schedule Trade-Off Modeling
         └───► [Export Engine] ─────────► Canonical Production Bible (PDF, CSV, JSON, ZIP)
```

By connecting creative generation directly to logistics, risk evaluation, and analytics, CineAgent Studio empowers filmmakers to make informed, data-driven decisions in minutes rather than weeks.

---

## 5. Key Features

1. **Autonomous Multi-Agent Production Pipeline**:
   Sequential execution of specialized AI agents (Story, Screenplay, Production Breakdown, Budget, and Schedule) with strict schema validation and narrative continuity.
2. **Richer Screenplay Generation**:
   Generates industry-standard formatted screenplays with customizable detail levels (*Concise*, *Cinematic*, and *Highly Detailed*).
3. **Advisory Script Doctor**:
   Non-destructive script review engine providing grounded category scores, narrative strengths, structural weaknesses, and production feasibility recommendations without altering the author's original script.
4. **Interactive Production What-If Simulator**:
   Instant offline scenario modeling allowing producers to experiment with modified target budgets and shoot durations to analyze cost/schedule trade-offs and affected scenes in real time.
5. **ClickHouse Production Analytics via MCP**:
   Real-time telemetry and multi-perspective production intelligence powered by ClickHouse Cloud using the Model Context Protocol (MCP).
6. **Canonical Production Bible Export**:
   Single-click download of complete production packages in PDF (documents), CSV (Excel-compatible spreadsheets with UTF-8 BOM), JSON (raw data), and bundled ZIP archives.

---

## 6. How It Works (High-Level Architecture)

CineAgent Studio is built on a modern, production-ready stack:

```
[React SPA Frontend]
        │ (REST API / JSON)
        ▼
[Express Server Gateway]
        ├── Node.js API Routes & Controllers
        ├── Google ADK (@google/adk) Agent Execution Framework
        ├── Gemini API (gemini-3.1-flash-lite / gemini-3.6-flash)
        └── Python Subprocess (mcp-clickhouse via StdioClientTransport)
                │
                ▼
        [ClickHouse Cloud Database] (asia-northeast1)
```

- **Frontend**: Single Page Application built with React and Vite featuring a sleek, dark-mode cinematic interface.
- **Backend Gateway**: Express.js server providing REST endpoints for pipeline orchestration, Script Doctor queries, What-If simulation, and export generation.
- **Agent Orchestrator**: Uses the official Google Agent Development Kit (`@google/adk`) with `LlmAgent` and `InMemoryRunner` to run specialized agent instances.
- **MCP Bridge**: Integrates `@modelcontextprotocol/sdk` to launch the official Python `mcp-clickhouse` server via stdio transport, persisting execution telemetry and running analytical queries against ClickHouse Cloud.

---

## 7. AI & Agent Architecture

The intelligence of CineAgent Studio is divided into specialized, single-responsibility agents:

| Agent Name | Primary Responsibility | Input Contract | Output Contract |
|---|---|---|---|
| **Story Agent** | Generates logline, synopsis, 3-act structure, and character roster | Title, Genre, Prompt, Target Budget/Days | Structured Story JSON |
| **Screenplay Agent** | Formats scenes, headings (`INT./EXT.`), action blocks, and dialogue | Story JSON, Detail Level | Screenplay Scene Array JSON |
| **Production Breakdown Agent** | Extracts cast, locations, props, wardrobe, VFX, and technical complexity | Screenplay JSON | Scene Breakdown Elements JSON |
| **Budget Agent** | Computes category cost allocations, scene costs, and budget reconciliation | Breakdown JSON, Target Budget | Reconciled Budget Summary JSON |
| **Schedule Agent** | Groups location shoots, minimizes moves, consolidates night blocks | Breakdown JSON, Budget JSON, Target Days | Shooting Day Schedule JSON |
| **Script Doctor Agent** | Evaluates pacing, structure, dialogue, feasibility, and commercial appeal | Screenplay JSON | Advisory Evaluation Score JSON |

### Architectural Principles:
- **Strict Specialization**: Each agent focuses on a single domain to prevent context pollution and hallucination.
- **Structured Handoffs**: Data passes between agents using strictly validated JSON schemas.
- **Continuity & Validation**: Downstream agents strictly preserve characters, locations, and narrative beats established upstream.

---

## 8. Google Technologies Used

CineAgent Studio deeply integrates the following core Google technologies:

1. **Google Gemini API**:
   - Models Used: `gemini-3.1-flash-lite` (default high-speed, cost-effective inference) and `gemini-3.6-flash`.
   - Used for structured JSON generation, screenplay formatting, asset extraction, financial estimation, and editorial analysis.
2. **Google Agent Development Kit (`@google/adk`)**:
   - Implements native `LlmAgent` definitions and `InMemoryRunner` execution loops for agent isolation and structured prompt management.
3. **Google Cloud Platform (GCP)**:
   - ClickHouse Cloud database instance hosted on Google Cloud infrastructure (`asia-northeast1.gcp.clickhouse.cloud`).

---

## 9. Model Context Protocol (MCP) + ClickHouse Cloud

CineAgent Studio leverages the **Model Context Protocol (MCP)** to establish a secure, standardized bridge between the Node.js backend runtime and **ClickHouse Cloud**.

### Why MCP?
- **Protocol Standardization**: Uses `@modelcontextprotocol/sdk` over stdio transport to communicate with the official Python `mcp-clickhouse` server without hardcoding custom database client drivers into agent code.
- **Security Isolation**: Keeps ClickHouse credentials isolated within the backend environment runtime.

### Production Analytics Capabilities:
ClickHouse Cloud acts as the analytical heart of the studio, storing and querying:
- `agent_runs`: Agent execution status, duration, and pipeline performance telemetry.
- `scene_metrics`: Per-scene estimated costs, complexity ratings, cast counts, and asset counts.
- `budget_summaries` & `budget_categories`: High-level financial allocations and cost drivers.
- `day_schedules`: Shooting day allocations and location density.

This enables real-time visual insights into project cost distribution, high-cost scene identification, location grouping efficiency, and cast resource bottlenecks.

---

## 10. Innovation: AI-Assisted Production Decision System

Most AI tools for film are simple text generators: you input a prompt, and you get a text script.

CineAgent Studio introduces a paradigm shift by implementing an end-to-end lifecycle loop:

```
GENERATE ──► ANALYZE ──► PLAN ──► REVIEW ──► SIMULATE ──► DELIVER
```

- **Generate**: Produce narrative screenplay content tailored to specific detail levels.
- **Analyze**: Extract physical production elements (cast, props, VFX, locations).
- **Plan**: Construct costed line-item budgets and optimized shooting day schedules.
- **Review**: Provide non-destructive Script Doctor feedback across 7 editorial categories.
- **Simulate**: Perform interactive What-If scenario modeling to explore budget and schedule constraints.
- **Deliver**: Export canonical Production Bibles in PDF, CSV, JSON, and ZIP.

---

## 11. Script Doctor (Advisory Review Engine)

The **Script Doctor** is a non-destructive advisory tool designed to give filmmakers actionable editorial feedback. 

- **7 Evaluation Categories**: Structure & Pacing, Dialogue Quality, Character Arc Clarity, Visual Storytelling, Production Feasibility, Genre Alignment, and Commercial Potential.
- **Overall Score**: Weighted composite quality score (0–100).
- **Actionable Feedback**: Grounded list of narrative strengths, identified red flags, and targeted recommendations.
- **Non-Destructive**: Evaluates the script without overwriting or mutating the underlying screenplay data.

---

## 12. Production What-If Simulator

Film producers frequently need to ask: *"What happens to our plan if our budget gets cut by 20%?"* or *"What if we have to shoot in 10 days instead of 12?"*

The **Production What-If Simulator** provides an interactive trade-off engine:
- **Interactive Controls**: Sliders and numerical inputs for target budget and target shoot days.
- **Instant Trade-Off Analysis**: Computes cost deltas, schedule variance %, affected scene counts, and risk implications instantly.
- **Offline & Fast**: Runs deterministically on the backend without making LLM calls or consuming API quota.
- **Non-Mutating**: Allows producers to explore alternative scenarios while leaving the canonical production plan intact.

---

## 13. Export Workspace (Production Bible)

CineAgent Studio includes a complete export engine to generate industry-standard deliverables:

- **PDF Documents**: Clean PDF exports for Screenplay (Courier script layout), Budget Breakdown, and Shooting Schedule.
- **CSV Spreadsheets**: Formatted CSV spreadsheets with UTF-8 BOM encoding for seamless opening in Microsoft Excel and Google Sheets.
- **JSON Data**: Complete raw production plan dataset for programmatic integrations.
- **Production Bible (ZIP)**: Single-click download that bundles all PDFs, CSVs, and JSON files into a structured `.zip` archive.

---

## 14. Demo & Deployment

- **Live Deployment URL**: `https://cineagent-studio.onrender.com`
- **Health Check Endpoint**: `https://cineagent-studio.onrender.com/health` (Returns `{"status":"ok"}`)
- **Demo Video**: 3-minute video walk-through demonstrating full end-to-end pipeline execution.
- **Primary Presentation Project**: *The Last Monsoon* (Sci-Fi / Climate Thriller).
- **Secondary Proof Project**: *Echoes Below* (Subterranean Mystery).

---

## 15. Evidence Checklist Reference

As documented in [`docs/PHASE6C_EVIDENCE_CHECKLIST.md`](file:///c:/Meet/Codin/Repo/CineAgentStudio/docs/PHASE6C_EVIDENCE_CHECKLIST.md), the system is verified across 10 essential product screenshots:
1. `01_Concept_Intake.png` — Form intake & constraint setup.
2. `02_Story_Package.png` — 3-Act structure & character roster.
3. `03_Rich_Screenplay.png` — Cinematic screenplay paper formatting.
4. `04_Production_Breakdown.png` — Scene asset extraction & filtering.
5. `05_Budget_Reconciliation.png` — Financial reconciliation & cost drivers.
6. `06_Shooting_Schedule.png` — Shooting day schedule & location grouping.
7. `07_ClickHouse_Insights.png` — Production analytics dashboard via MCP.
8. `08_Script_Doctor.png` — Advisory narrative quality scorecards.
9. `09_WhatIf_Simulator.png` — Scenario modeling & trade-off deltas.
10. `10_Export_Workspace.png` — Production Bible multi-format ZIP export.

---

## 16. Technical Highlights & Quality Assurance

- **Schema Validation & Format Repair**: All LLM JSON responses are strictly validated against schema contracts with automatic single-retry format repair passes.
- **Math Reconciliation**: Budget models enforce `scene_linked + project_wide + contingency = estimated_total` to guarantee zero mathematical discrepancy.
- **Schedule Normalization**: Shooting schedules ensure 100% scene coverage with zero missing or duplicate scenes.
- **Security Isolation**: Zero client-side API key exposure. All Gemini API keys, ClickHouse passwords, and MCP environment variables remain strictly server-side.
- **Automated Test Suite**: 379 passing unit, component, schema, pipeline, and telemetry tests with 0 failures.

---

## 17. Practical Impact & Value

- **For Indie Filmmakers**: Provides professional-grade breakdown, budgeting, and scheduling in minutes, allowing them to pitch to investors and plan shoots with confidence.
- **For Line Producers & PMs**: Eliminates days of tedious script markup, serving as an intelligent co-pilot for initial budget estimates and shooting schedule drafts.
- **For Film Studios**: Enables rapid feasibility testing of multiple script concepts before committing production capital.

---

## 18. Engineering Challenges Encountered

1. **LLM Output Formatting & Code-Fence Sanitization**:
   Large screenplay and schedule outputs occasionally included unescaped control characters or markdown formatting. We implemented robust JSON extraction regex and schema validation layers with fallback format repair routines.
2. **Cross-Agent Narrative & Logistics Continuity**:
   Ensuring that characters, locations, and props extracted by the Breakdown Agent strictly matched the Screenplay Agent output required strict contract design and prompt engineering.
3. **ClickHouse MCP Integration & Schema Evolution**:
   Setting up the stdio transport bridge between Node.js and the Python `mcp-clickhouse` server required careful subprocess management, environment isolation, and DDL schema migration handling.
4. **Single-Container Dual-Runtime Deployment**:
   Deploying to Render Free Web Service required authoring a custom multi-stage Dockerfile combining Node.js 20, Python 3.10, and build dependencies into a lean single container.

---

## 19. Future Work

- **Real-Time Collaborative Editing**: Multi-user editing for line producers to tweak scene elements directly on the breakdown board.
- **Automated Storyboard Visual Generation**: Integrating image generation models to produce visual storyboard panels for each screenplay scene.
- **Multi-Currency & Regional Rate Cards**: Supporting international filming tax incentives, union scale rates (SAG-AFTRA/DGA), and localized currency conversions.
- **Live Talent & Location Database Connections**: Connecting location tags to real-world location databases and talent availability APIs.
