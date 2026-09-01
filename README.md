# CineAgent Studio 🎬

> **Autonomous Multi-Agent AI Film Pre-Production & Planning Platform**

CineAgent Studio is an end-to-end autonomous film pre-production platform powered by **Google ADK**, **Gemini API** (`gemini-3.1-flash-lite`), and **ClickHouse Cloud MCP** analytics. It transforms high-level movie loglines into complete production assets: formatted screenplays, scene breakdowns, costed budgets, optimized shooting schedules, real-time telemetry analytics, and multi-format export packages (PDF, CSV, JSON, ZIP).

---

## 🌟 Key Features

1. **Story Agent** (Google ADK / Gemini): Generates narrative architecture, three-act structure, and character rosters.
2. **Screenplay Agent** (Google ADK / Gemini): Formats scene headings (`INT./EXT.`), action blocks, dialogue lines, and transitions according to industry standards.
3. **Production Breakdown Agent** (Google ADK / Gemini): Extracts scene-level elements (cast, locations, props, vehicles, wardrobe, VFX, special equipment).
4. **Budget Agent** (Google ADK / Gemini): Calculates category cost allocations, scene-linked costs, contingency buffers, and budget reconciliation.
5. **Schedule Agent** (Google ADK / Gemini + Deterministic Repair): Optimizes shooting days, location consolidation, and night blocks with fallback structural validation.
6. **ClickHouse Analytics & Telemetry**: Logs real-time agent execution telemetry, scene metrics, category cost drivers, and shooting day schedules to ClickHouse Cloud using the official `mcp-clickhouse` server via `@modelcontextprotocol/sdk`.
7. **Production Planning UI**: Modern dark-mode React workspace featuring 5 views: Breakdown, Budget, Shooting Schedule, Production Insights, and Export Workspace.
8. **Multi-Format Export Engine**: Downloads complete canonical Production Bibles in JSON, PDF, CSV, Excel-compatible CSV (UTF-8 BOM), and full ZIP archives offline or live.

---

## 🏗 Architecture Overview

```
[User Logline Intake]
         │
         ▼
[1. Story Agent] ───────► (Google ADK / Gemini 3.1 Flash Lite)
         │
         ▼
[2. Screenplay Agent] ──► (Screenplay Output & Format Quality Validation)
         │
         ▼
[3. Breakdown Agent] ───► (Scene Asset Extraction & Complexity Metrics)
         │
         ▼
[4. Budget Agent] ──────► (Financial Cost Allocation & Reconciliation)
         │
         ▼
[5. Schedule Agent] ────► (Location Move & Night-Block Optimization + Repair)
         │
         ├────────────────────────────────────────┐
         ▼                                        ▼
[ClickHouse Cloud MCP]                 [Canonical Export Engine]
(agent_runs, scene_metrics,            (JSON, PDF, CSV, XLSX-CSV, ZIP)
 budget_summaries, day_schedules)                 │
                                                  ▼
                                      [React Export Workspace]
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: 3.10+ (for official `mcp-clickhouse` server if running ClickHouse integration)

### 2. Environment Configuration
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your credentials in `.env`:

```env
# Google GenAI Key
GOOGLE_GENAI_API_KEY=your_gemini_api_key_here

# Selected Gemini Model
GEMINI_MODEL=gemini-3.1-flash-lite

# Demo Mode (Set true for offline execution without Gemini or ClickHouse)
CINEAGENT_DEMO_MODE=false

# ClickHouse Cloud MCP Settings
CLICKHOUSE_HOST=your_clickhouse_host.clickhouse.cloud
CLICKHOUSE_PORT=8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_secure_clickhouse_password
CLICKHOUSE_DATABASE=default
CLICKHOUSE_SECURE=true
CLICKHOUSE_ALLOW_WRITE_ACCESS=true
```

### 3. Installation
Install all backend dependencies:

```bash
npm install
```

Install all client dependencies:

```bash
cd client && npm install && cd ..
```

---

## 🧪 Testing & Verification

Run the comprehensive unit test suite (296 passing tests):

```bash
npm test
```

Build the client production bundle:

```bash
cd client && npm run build
```

---

## 💻 Running the Application

### Option A: Demo Mode (Fully Offline)
Set `CINEAGENT_DEMO_MODE=true` in `.env`, then start the gateway server:

```bash
node server/index.js
```

Start the Vite development frontend:

```bash
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

### Option B: Live Production Mode
Set `CINEAGENT_DEMO_MODE=false` in `.env` and ensure `GOOGLE_GENAI_API_KEY` is set. Then start the backend server and client frontend.

---

## 📦 Export Formats

- **Production Bible ZIP**: Complete project package containing all 12 assets in JSON, PDF, and CSV formats.
- **Screenplay**: Industry-standard formatted PDF and raw JSON.
- **Production Breakdown**: Full scene element matrix CSV and JSON.
- **Budget**: Executive summary PDF, Excel-compatible CSV (UTF-8 BOM), and JSON.
- **Shooting Schedule**: Production schedule PDF, Excel-compatible CSV (UTF-8 BOM), and JSON.
- **Production Insights**: Cost intelligence and telemetry JSON.

---

## 🔒 Security & Privacy

- All sensitive keys (`GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`) are kept strictly on the backend gateway.
- Client state and export packages are automatically sanitized by `sanitizeExportPayload`.
- File exports strip dangerous characters and enforce relative paths to prevent path traversal vulnerabilities.
- `.env` files are excluded from git tracking via `.gitignore`.
