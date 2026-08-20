# ClickHouse MCP Implementation & Architecture Reference

## Overview

This document defines the official ClickHouse Model Context Protocol (MCP) integration for **CineAgent Studio**, supporting hackathon compliance, automated AI agent telemetry, and production analytics.

---

## 1. Compliance Decision & Hosted Endpoint Evaluation

### Evaluation of ClickHouse Cloud Hosted Endpoint (`https://mcp.clickhouse.cloud/mcp`) vs. Official `mcp-clickhouse` Server

The ClickHouse Cloud console exposes a hosted remote MCP endpoint (`https://mcp.clickhouse.cloud/mcp`). Below is the evaluation of both options:

| Question | Hosted Remote Endpoint (`https://mcp.clickhouse.cloud/mcp`) | Official `mcp-clickhouse` Server (`mcp-clickhouse` 0.4.1) |
|---|---|---|
| **A. Hosted Service** | Official ClickHouse-hosted remote service | Official ClickHouse Python server (`ClickHouse/mcp-clickhouse`) |
| **B. Hackathon Requirement** | Requires interactive browser OAuth 2.0 flow | Connects via standard application process stdio transport |
| **C. Application Process** | Remote HTTP endpoint | Application spawns official `mcp-clickhouse` subprocess |
| **D. Google ADK Direct Connect** | Restricted by OAuth browser authentication | Connected via Node.js `@modelcontextprotocol/sdk` StdioClient |
| **E. Authentication** | Interactive OAuth 2.0 PKCE browser authorization | Standard database credentials (`CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`) |
| **F. Exposed Tools** | Read-only database listing & query tools | Exposes `run_query`, `list_databases`, `list_tables` |
| **G. Write Operations** | Read-only scoped queries | Supports write operations via `CLICKHOUSE_WRITE_ACCESS=true` |

### Compliance Decision Statement
> **Selected compliance approach; compliance will be marked verified only after successful runtime testing.**

We select **Option B (Official `mcp-clickhouse` Server)** as the primary runtime integration path for CineAgent Studio. This allows headless backend execution, supports both read and write operations (`agent_runs` logging and `scene_metrics` tracking) via MCP `run_query`, and avoids interactive OAuth browser authorization blockers during automated agent operations.

---

## 2. Server & Transport Specifications

- **PyPI Package**: `mcp-clickhouse` (v0.4.1 verified)
- **Official Repository**: `https://github.com/ClickHouse/mcp-clickhouse`
- **Subprocess Command**: `python -m mcp_clickhouse.main run` (or `mcp-clickhouse run`)
- **Transport**: `stdio` (JSON-RPC 2.0 over standard I/O streams using `@modelcontextprotocol/sdk` `StdioClientTransport`)
- **Node Client SDK**: `@modelcontextprotocol/sdk` v1.30.0 (`Client` and `StdioClientTransport`)

---

## 3. Discovered Tools & Schemas

The official `mcp-clickhouse` 0.4.1 server registers the following verified MCP tools:

1. `run_query`: Executes SQL queries against the ClickHouse Cloud cluster.
   - Argument: `{ "query": "string" }`
2. `list_databases`: Lists all databases in the ClickHouse cluster.
3. `list_tables`: Lists tables in a specified database with optional pagination and detailed column metadata.
   - Arguments: `{ "database": "string", "like": "string", "page_token": "string", "page_size": 50 }`
4. `run_chdb_select_query`: (Optional) Executes queries using the embedded chDB engine if enabled (`CHDB_ENABLED=true`).

---

## 4. Environment Variables & Security

### Required Environment Variables
- `CLICKHOUSE_HOST`: Hostname of the ClickHouse Cloud instance (e.g. `xyz.clickhouse.cloud`).
- `CLICKHOUSE_PORT`: HTTPS port for ClickHouse Cloud (default: `8443`).
- `CLICKHOUSE_USER`: ClickHouse username (default: `default`).
- `CLICKHOUSE_PASSWORD`: ClickHouse password.
- `CLICKHOUSE_DATABASE`: Target database name (default: `default`).
- `CLICKHOUSE_SECURE`: Set to `true` to force TLS/SSL connection.
- `CLICKHOUSE_VERIFY`: Set to `true` to enforce SSL certificate verification.
- `CLICKHOUSE_WRITE_ACCESS`: Set to `true` to enable write operations (supported in v0.3.0+).
- `CLICKHOUSE_ALLOW_WRITE_ACCESS`: Set to `true` (backward-compatible fallback).

### Destructive Operations Guardrail
- `CLICKHOUSE_ALLOW_DROP`: Set to `false` (default). Destructive operations like `DROP TABLE` or `DROP DATABASE` are **strictly prohibited** in runtime production.

---

## 5. CineAgent ClickHouse Schema Definitions

The CineAgent Studio schema is automatically established through MCP `run_query`:

### `agent_runs` Table
```sql
CREATE TABLE IF NOT EXISTS agent_runs (
    run_id String,
    project_id String,
    agent_name String,
    status String,
    duration_ms UInt32,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, created_at)
```

### `scene_metrics` Table
```sql
CREATE TABLE IF NOT EXISTS scene_metrics (
    project_id String,
    scene_id String,
    location String,
    cast_count UInt16,
    estimated_cost Float64,
    shooting_day UInt16,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (project_id, scene_id)
```

---

## 6. Execution Flow Architecture

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
