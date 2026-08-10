# ARCHITECTURE DECISION DOCUMENT

## 1. Corrected Core System Architecture

The updated system architecture integrates the official Google Agent Development Kit (ADK) as the primary agent execution framework and ClickHouse Model Context Protocol (MCP) server as the analytical storage driver.

```
┌────────────────────────────────────────────────────────┐
│               Web Client (React / Vite)                │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WebSocket / EventStream
                            ▼
┌────────────────────────────────────────────────────────┐
│             Node.js Backend Gateway Server             │
└───────────────────────────┬────────────────────────────┘
                            │ Connects to Agent Run Session
                            ▼
┌────────────────────────────────────────────────────────┐
│           Google Agent Development Kit (ADK)           │
│        (Runs Orchestrator & Specialized Agents)        │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Google Gemini AI      │   │   ClickHouse MCP Server   │
│ (1.5/2.0 Flash / Pro)     │   │      (mcp-clickhouse)     │
└───────────────────────────┘   └─────────────┬─────────────┘
                                              │ Tools Protocol
                                              ▼
                                ┌───────────────────────────┐
                                │     ClickHouse Cloud      │
                                └───────────────────────────┘
```

---

## 2. Multi-Agent Design & Topology (Google ADK Native)

* **Orchestrator Agent**:
  - Orchestrates the sequential pre-production state pipeline: `Intake Form` → `Story` → `Screenplay` → `Budget` → `Schedule`.
  - Dispatches calls to sub-agents and validates their JSON-formatted payloads.
* **Story Agent**:
  - Prompted to produce Logline, Synopsis, and Main Characters using Gemini 1.5 Pro.
* **Screenplay Agent**:
  - Translates story concepts into scene-by-scene script outputs in Fountain-compatible formatting.
* **Budget Agent**:
  - Analyzes locations, cast, and visual effects to calculate BTL/ATL budget structures.
* **Schedule Agent**:
  - Compiles scenes into a production-optimized shooting schedule.

---

## 3. Tool Binding & ClickHouse MCP Pipeline

* All database storage and retrieval actions are defined as tool declarations.
* When the Budget Agent completes an estimate, the Orchestrator invokes the `mcp-clickhouse` write database tools.
* The frontend requests analytics data by triggering MCP read tools via the Node.js backend to display dashboards in real-time.
