# CineAgent Studio — Demo Environment Preparation & Pre-Record Guide

This document details the production environment verification, readiness checks, data tiers, quota precautions, browser configuration, and pre-record checklist for presenting **CineAgent Studio** live.

---

## 🌐 1. Production Deployment Details
- **Production Host**: Render Free Web Service
- **Public URL**: `https://cineagent-studio.onrender.com`
- **Health Check Endpoint**: `https://cineagent-studio.onrender.com/health`
- **Routing**: Single-service container serving React static bundle (`client/dist`) and API endpoints (`/api/...`) on `0.0.0.0:${PORT}` with Express 5 SPA fallback (`/{*splat}`).

---

## ⚙️ 2. Runtime Configuration
- **Live Mode**: `CINEAGENT_DEMO_MODE=false`
- **Active Gemini Model**: `GEMINI_MODEL=gemini-3.1-flash-lite`
- **Google ADK Version**: `^1.6.0`
- **MCP Package**: `mcp-clickhouse` PyPI package via `@modelcontextprotocol/sdk` `StdioClientTransport`
- **ClickHouse Cloud Target**: Native TLS endpoint (`u2p05autaa.asia-northeast1.gcp.clickhouse.cloud:8443`)

---

## 🟢 3. Component Readiness Audit

| Component | Status | Details |
|---|---|---|
| **Render Web Service** | `PASS` | Service live on Render, zero crash loops, `/health` returning `200 OK`. |
| **Gemini API** | `PASS` | `gemini-3.1-flash-lite` model responsive and verified. |
| **ClickHouse MCP** | `PASS` | Official `mcp-clickhouse` server process running via stdio, tables verified. |
| **Export Service** | `PASS` | Production Bible ZIP, Screenplay PDF, Budget CSV, and JSON packages operational. |

---

## 📊 4. Demo Data Tier Strategy

To protect against unexpected LLM availability or network fluctuations during recording:

- **Tier 1 (Primary Live Execution)**:
  - Perform a live generation of *The Last Monsoon* ($2.5M budget, 5 shoot days) through the production web UI.
- **Tier 2 (Pre-Generated Real Payload)**:
  - If Gemini API experiences a temporary rate limit spike during recording, load the pre-generated real production plan payload for *The Last Monsoon*.
- **Tier 3 (Offline Demo Backup)**:
  - If internet connection or API availability is severed completely, enable `CINEAGENT_DEMO_MODE=true` to demonstrate deterministic local fixtures.

---

## 🖥 5. Presenter Browser Setup Guidelines
- **Browser**: Google Chrome or Microsoft Edge.
- **Display Resolution**: 1080p (1920x1080).
- **Zoom**: 100% or 110% for crisp typography (`Courier Prime` screenplay renderer).
- **Tab Cleanliness**: Close all unrelated tabs and bookmarks bar.
- **Pre-warming**: Access `https://cineagent-studio.onrender.com/health` **3 minutes before recording** to wake up the Render Free instance from 15-minute idle sleep.

---

## ⏺ 6. Pre-Record Checklist

Before hitting RECORD:

- [ ] Render production URL opens without errors.
- [ ] `GET /health` returns `{"status":"ok","demoMode":false}`.
- [ ] Gemini API key is valid on backend gateway.
- [ ] ClickHouse MCP connection status is green.
- [ ] Browser window resized to 1920x1080 fullscreen.
- [ ] Browser extension icons hidden.
- [ ] Presenter microphone audio level tested.
- [ ] Screen recorder set to 1080p 60fps.
- [ ] *The Last Monsoon* input text ready for pasting.
- [ ] Backup Tier 2 data loaded in secondary window.

---

## 🔄 7. Failure Recovery Protocol
If an error occurs during the live recording:
1. **Transient Gemini 429**: Click **Generate Production Plan** one more time (handled by in-process lock and retry).
2. **Prolonged 429**: Seamlessly switch to Tier 2 pre-generated payload.
3. **Network Disconnection**: Switch to Tier 3 (`CINEAGENT_DEMO_MODE=true`).
