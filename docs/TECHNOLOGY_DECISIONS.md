# Stack & Orchestration Architecture Decisions

## 1. Selected Stack Components

* **Frontend**: React (Vite) Web Client.
* **Backend**: Node.js API server bridging HTTP traffic to the Google ADK and ClickHouse MCP runtimes.
* **Agent Engine**: Google Agent Development Kit (ADK) using native configuration bindings.
* **LLM Models**: Gemini 1.5 Flash (for fast iterations) and Gemini 1.5 Pro (for complex script synthesis).
* **Database Driver**: Official `mcp-clickhouse` server process routing Model Context Protocol tool requests to ClickHouse Cloud.

---

## 2. Core Refinements

1. **ClickHouse Driver Refinement**:
   - *Previous Approach*: `@clickhouse/client` wrapper.
   - *Corrected Approach*: Launch a local Node.js child process running `mcp-clickhouse` as a subprocess. The backend acts as an MCP Client using standard stdin/stdout/SSE channels to invoke ClickHouse tools.
2. **Orchestrator Refinement**:
   - *Previous Approach*: Custom Express logic driving LLM prompts.
   - *Corrected Approach*: Native Google ADK architecture defining agents, tools, and connections.
3. **No Private Thought Exposure**:
   - Screen out all internal LLM reasoning outputs. UI shows status notifications (e.g., "Story Agent completed", "Executing ClickHouse write tool").
