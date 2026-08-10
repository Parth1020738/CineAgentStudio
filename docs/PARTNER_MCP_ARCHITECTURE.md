# Partner ClickHouse MCP Architecture

## 1. Runtime Component Topology

The system uses the Model Context Protocol (MCP) to bind the Google ADK Agent Runtime to ClickHouse Cloud.

```
┌─────────────────────────────────┐
│     Google ADK Agent Runtime    │
│  (Configured with MCP Client)   │
└────────────────┬────────────────┘
                 │
                 │ MCP Tool Call (JSON-RPC)
                 ▼
┌─────────────────────────────────┐
│    ClickHouse MCP Server        │
│      (mcp-clickhouse)           │
└────────────────┬────────────────┘
                 │
                 │ ClickHouse TCP/HTTP
                 ▼
┌─────────────────────────────────┐
│      ClickHouse Cloud           │
└─────────────────────────────────┘
```

---

## 2. MCP Server Execution & Connection

1. **Start/Deployment**:
   - The ClickHouse MCP server runs as a background process using `npx @clickhouse/mcp-clickhouse` or a localized configuration wrapper.
   - The Node.js server spawns the MCP process during startup, establishing stdin/stdout pipes to exchange JSON-RPC packets.

2. **Google Agent Integration**:
   - The Google ADK Client defines tools matching the schema returned by the ClickHouse MCP server.
   - The Google Agent invokes these tools using structured parameter blocks (e.g., executing queries, writing logs).

3. **Required Tool Schemas**:
   - `execute_query`: Runs standard ClickHouse SQL operations.
   - `insert_data`: Writes structured metrics into target tables.

4. **Task-Specific Workloads**:
   - **Story & Screenplay Logs**: When scripts are completed, execution telemetry (tokens, duration, scene count) is written via MCP.
   - **Production Budgeting**: Scene analysis tables (props, actors, costs) are inserted into the database.
   - **Dashboard Visualization**: The React client requests metrics via standard ClickHouse MCP queries.
