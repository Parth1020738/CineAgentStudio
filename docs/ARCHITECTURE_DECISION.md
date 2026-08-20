# ARCHITECTURE DECISION DOCUMENT

## 1. Verified Core System Architecture

The updated system architecture integrates the official Google Agent Development Kit (ADK) as the primary agent execution framework and the official ClickHouse Model Context Protocol (MCP) server as the analytical storage driver.

```
React Client (Vite)
    │
    ▼
Node Gateway (Express)
    │
    ├──► Google ADK (Gemini 1.5 Flash) ──► Story Agent
    │          │
    │          ▼ (ADK Tool Call / MCP Integration)
    └──► MCP Client (@modelcontextprotocol/sdk - StdioClientTransport)
               │
               ▼ (stdio JSON-RPC subprocess)
         mcp-clickhouse (Python 0.4.1)
               │
               ▼ (run_query / list_databases / list_tables)
         ClickHouse Cloud Service
```

---

## 2. ClickHouse MCP Integration Rationale

- **Official Partner Integration**: CineAgent Studio uses the official PyPI `mcp-clickhouse` server (v0.4.1) over `stdio` transport.
- **Why ClickHouse is Essential**: ClickHouse Cloud provides high-performance analytical storage for CineAgent Studio agent execution telemetry (`agent_runs`) and production scene metrics (`scene_metrics`).
- **No Direct Driver Bypass**: All Partner database interactions execute strictly through MCP `run_query`.
- **Headless Execution**: Uses standard database environment variables (`CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_SECURE=true`, `CLICKHOUSE_WRITE_ACCESS=true`), enabling automated headless agent operation without interactive OAuth browser authorization.

---

## 3. Multi-Agent Design & Topology (Google ADK Native)

* **Story Agent**:
  - Prompted to produce Logline, Synopsis, 3-Act Structure, and Character profiles using Gemini 1.5 Flash.
  - Automatically logs execution telemetry (`run_id`, `project_id`, `agent_name`, `status`, `duration_ms`) to ClickHouse Cloud via MCP `run_query`.
* **Google ADK Tool Binding**:
  - ADK agent invokes ClickHouse MCP tools (`queryProductionAnalytics`, `executeAdkMcpQuery`) to query past project runs and analytical telemetry.
