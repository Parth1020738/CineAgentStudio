# CineAgent Studio — Requirement Traceability Matrix

| Requirement / Phase | Feature | Status | Verification Evidence |
|---|---|---|---|
| **Phase 1A** | Foundation & Project Setup | **COMPLETE** | Structure, dependencies, and configuration setup verified. |
| **Phase 1B** | Google ADK & Gemini Setup | **COMPLETE** | `storyAgent.js` running Google ADK with Gemini 3.6 Flash. |
| **Phase 2** | ClickHouse MCP Runtime | **COMPLETE AND VERIFIED** | Connected to official `mcp-clickhouse` server via StdioClientTransport / SSEClientTransport. Recorded runs to `agent_runs` table in ClickHouse Cloud. |
| **Phase 3A** | Screenplay Agent Foundation | **COMPLETE AND VERIFIED** | Created `screenplayAgent.js` using Google ADK & Gemini to consume Story output. |
| **Phase 3B** | Screenplay Format & Quality Rules | **COMPLETE AND VERIFIED** | Implemented `ScreenplayOutputSchema` (Zod) enforcing 2-3 scenes, headings (`INT./EXT.`), action, dialogue, and transitions. 17 unit tests passing. |
| **Phase 3C** | Multi-Agent Pipeline | **COMPLETE AND VERIFIED** | Implemented `runStoryToScreenplayPipeline` and continuity validation in `pipeline.js`. |
| **Phase 3D** | Screenplay ClickHouse Telemetry | **COMPLETE AND VERIFIED** | Both `story_agent` and `screenplay_agent` telemetry recorded and queryable via MCP tools in ClickHouse Cloud. |
| **Phase 3E** | React UI & Gateway Endpoint | **COMPLETE AND VERIFIED** | Created React frontend web app with intake form, progress stepper, formatted screenplay paper viewer (`Courier Prime`), telemetry panel, and `POST /api/pipeline/story-to-screenplay` gateway endpoint. |
| **Phase 3F** | Final Phase 3 Verification & Freeze | **COMPLETE AND VERIFIED** | End-to-end pipeline verified, 46/46 unit & live tests passing, frontend production build verified, zero prohibited dependencies, scope frozen. |
| **Phase 4A** | Production Breakdown Agent | **COMPLETE AND VERIFIED** | Created `breakdownAgent.js` using Google ADK & Gemini. Defined `ProductionBreakdownSchema`, screenplay fidelity checks, 15 new unit tests, and live pipeline integration. |
| **Phase 4B** | Budget Agent | **COMPLETE AND VERIFIED** | Created `budgetAgent.js` using Google ADK & Gemini. Defined `BudgetOutputSchema`, category cost model, target budget variance logic, 25 new unit tests, and end-to-end 4-agent pipeline integration. |
| **Phase 4C** | ClickHouse Production Analytics | **COMPLETE AND VERIFIED** | Created `server/services/productionAnalytics.js`. Persisting breakdown scene metrics, budget summaries, category costs, and major cost drivers into ClickHouse Cloud via official MCP `run_query`. 7 new unit tests, verified all 7 analytics query functions with real pipeline run. |
| **Phase 4D** | Schedule Agent | **COMPLETE AND VERIFIED** | Created `server/agents/scheduleAgent.js` using Google ADK & Gemini. Defined `ScheduleOutputSchema`, location/night-block optimization, 20 new unit tests, verified end-to-end 5-agent pipeline (Story -> Screenplay -> Breakdown -> Budget -> Schedule) and ClickHouse `shooting_day` persistence. |
| **Phase 4E** | Production Planning UI | **COMPLETE AND VERIFIED** | Implemented React Production Planning workspace (`BreakdownView`, `BudgetView`, `ScheduleView`, `ProductionInsightsView`) connected to `POST /api/pipeline/production-plan`. 11 new Phase 4E unit tests (120 total unit tests), clean Vite production build. |

