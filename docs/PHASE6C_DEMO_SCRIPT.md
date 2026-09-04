# CineAgent Studio — 3-Minute Hackathon Demonstration Script

## Overview & Demo Objective
This document provides the exact timestamped narration script, UI actions, technical talking points, and visual flow for presenting **CineAgent Studio** during a 3-minute hackathon demonstration.

---

## Demo Concept Scenario
- **Title**: *The Last Monsoon*
- **Genre**: Historical Survival Thriller
- **Logline**: During the final days of British colonial rule in India, a young railway engineer and a stranded journalist must keep a damaged evacuation train moving through catastrophic monsoon floods while secretly transporting a group of civilians targeted by a violent militia.
- **Tone**: Tense, emotional, grounded, cinematic
- **Target Budget**: $2,500,000
- **Target Shoot Days**: 5

---

## ⏱ 3-Minute Timed Demonstration Breakdown

| Timestamp | UI Screen / Action | Presenter Narration | Key Technical Points |
|---|---|---|---|
| **0:00–0:20** | **App Header / Home Workspace** | *"Independent filmmakers face a massive barrier between scriptwriting and physical production—cost estimation, script breakdown, and shooting schedules take weeks of manual work. Meet **CineAgent Studio**, an autonomous multi-agent production studio powered by Google ADK and Gemini."* | • Film pre-production bottleneck.<br>• Introduce CineAgent Studio.<br>• Autonomous multi-agent pipeline. |
| **0:20–0:40** | **Concept Intake Form** | *"I'll input our film concept: 'The Last Monsoon'—a historical survival thriller about an evacuation train trapped by floods in 1947 India. I'll set our target budget to \$2.5 Million across 5 shooting days, and hit **Generate Production Plan**."* | • Intake form inputs.<br>• Single concept entry.<br>• Target constraints set. |
| **0:40–1:00** | **Story & Screenplay Viewers** | *"Behind the scenes, our **Story Agent** structures a three-act narrative and character arcs using Google ADK with `gemini-3.1-flash-lite`. It hands off validated data to our **Screenplay Agent**, generating production-ready scenes in industry-standard format."* | • Google ADK + Gemini API.<br>• Structured Zod schemas.<br>• Formatted Screenplay (`Courier Prime`). |
| **1:00–1:30** | **Production Breakdown View** | *"Next, the **Breakdown Agent** parses every scene into physical production elements: locations, cast, props, special effects, and production complexity—all validated for continuity."* | • Autonomous element extraction.<br>• Scene complexity scoring.<br>• Production element matrix. |
| **1:30–1:55** | **Budget View** | *"Our **Budget Agent** calculates scene-linked costs, category allocations, and budget reconciliation against our \$2.5M target—identifying major cost drivers like train stunts and rain machines."* | • Scene-linked & category budgets.<br>• Variance tracking.<br>• Cost driver identification. |
| **1:55–2:15** | **Schedule View** | *"The **Schedule Agent** optimizes our 5-day shoot, grouping location moves and night blocks to minimize crew moves and budget overruns."* | • Multi-day shooting schedule.<br>• Location move optimization.<br>• Night block consolidation. |
| **2:15–2:35** | **ClickHouse Insights View** | *"Every agent execution emits real-time telemetry into **ClickHouse Cloud** via official **MCP stdio tools**, powering production analytics on cost distribution and cast load."* | • Model Context Protocol (MCP).<br>• ClickHouse Cloud integration.<br>• Real-time production analytics. |
| **2:35–2:50** | **Export Workspace** | *"Finally, with one click, CineAgent Studio generates a complete **Production Bible ZIP**, including PDF screenplays, CSV budgets, and JSON packages."* | • Instant Production Bible ZIP.<br>• PDF & CSV generation.<br>• Zero LLM call on export. |
| **2:50–3:00** | **Final Summary & Call to Action** | *"CineAgent Studio transforms weeks of film pre-production into minutes—bringing autonomous AI orchestration to independent filmmaking. Thank you!"* | • Massive time savings.<br>• Production readiness.<br>• Wrap up. |

---

## 🚫 What NOT to Explain During the Demo
To keep the presentation tight and compelling within 3 minutes:
- **Do NOT explain internal JavaScript helper functions** (`escapeSqlString`, `sanitizeExportPayload`).
- **Do NOT explain Zod schema validation mechanics** or code-level regexes.
- **Do NOT troubleshoot live network calls or LLM latency**.
- **Do NOT detail local Docker build steps** or environment variable names (`CLICKHOUSE_PASSWORD`, `GOOGLE_GENAI_API_KEY`).
