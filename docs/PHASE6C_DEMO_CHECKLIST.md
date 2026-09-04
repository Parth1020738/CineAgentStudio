# CineAgent Studio — Demonstration Environment Readiness Checklist

This document provides a pre-presentation verification checklist to ensure all environment, network, database, and browser requirements are verified before recording or presenting live.

---

## 📋 Pre-Demo Environment Checklist

### 1. Web Service & Server Status
- [ ] **Render Web Service Awake**: URL `https://cineagent-studio.onrender.com` accessed within last 5 minutes (eliminating 15-minute cold start).
- [ ] **Health Endpoint Verification**: `GET /health` returns `200 OK` (`{"status":"ok","demoMode":false}`).
- [ ] **Port Binding**: Bound cleanly to `0.0.0.0:${PORT}`.

### 2. AI & Agent Pipeline Status
- [ ] **Gemini API Key Active**: `GOOGLE_GENAI_API_KEY` configured in environment.
- [ ] **Active Gemini Model**: `GEMINI_MODEL=gemini-3.1-flash-lite`.
- [ ] **Google ADK Framework**: Initialized and verified in backend.
- [ ] **Demo Mode**: `CINEAGENT_DEMO_MODE=false` (Live mode enabled for demonstration).

### 3. ClickHouse Cloud & MCP Status
- [ ] **ClickHouse Cloud Connected**: Remote cluster `u2p05autaa.asia-northeast1.gcp.clickhouse.cloud:8443` reachable.
- [ ] **MCP Subprocess**: `python -m mcp_clickhouse.main run` running via `StdioClientTransport`.
- [ ] **Analytics Tables**: `agent_runs`, `scene_metrics`, `project_budgets`, `budget_categories`, `budget_drivers` schemas verified.

### 4. Browser & Display Setup
- [ ] **Browser**: Chrome or Edge in Fullscreen / Presentation mode.
- [ ] **Screen Resolution**: 1080p (1920x1080) for optimal visual clarity.
- [ ] **Zoom Level**: 100% (or 110% for crisp typography).
- [ ] **Audio/Microphone**: Clear input audio for presenter narration.

### 5. Production Export Verification
- [ ] **Production Bible ZIP Download**: Tested and verified downloading `.zip` package.
- [ ] **Screenplay PDF Download**: Tested and verified downloading formatted `.pdf`.
- [ ] **Budget CSV Download**: Tested and verified downloading `.csv`.

---

## 📷 Screenshot / Evidence Checklist

Prepare screenshots or video recordings of the following 9 key screens for backup and Devpost submission:

1. **Concept Intake Form** (Filled with *The Last Monsoon* parameters).
2. **Story Package View** (3-act narrative structure & character arcs).
3. **Screenplay View** (`Courier Prime` industry-formatted script).
4. **Production Breakdown Matrix** (Scene elements, props, VFX, complexity).
5. **Budget Reconciliation View** (Category costs, variance, major cost drivers).
6. **Shooting Schedule View** (5-day shooting schedule, location moves).
7. **ClickHouse Insights Workspace** (Real-time cost & cast load telemetry graphs).
8. **Export Workspace** (Production Bible CTA & export cards).
9. **Downloaded Archive Verification** (Extracted Production Bible ZIP contents).
