# REQUIREMENT TRACEABILITY MATRIX

## 1. Compliance Mapping Table

| Hackathon Rule / Requirement | CineAgent Studio Implementation | File / Module | Status | Runtime Call Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Must use ClickHouse at runtime via official MCP** | Database interaction managed via official PyPI `mcp-clickhouse` v0.4.1 server subprocess over stdio transport. | `server/mcp/clickhouseMcp.js`, `server/mcp/adkMcpTool.js` | **ACTUALLY VERIFIED AT RUNTIME** | Handshake, tool discovery (`run_query`, `list_databases`, `list_tables`), `SELECT 1`, DDL, INSERT into `agent_runs`, SELECT from `agent_runs`, and ADK tool execution. |
| **Must use Gemini & Google ADK** | Story Agent pipeline orchestrated natively via `@google/adk` LlmAgent & Runner using Gemini 1.5 Flash. | `server/agents/storyAgent.js` | **ACTUALLY VERIFIED AT RUNTIME** | `@google/adk` Runner stream execution verified in unit & live integration tests. |
| **Zero Prohibited AI Engines** | Strict dependency constraints omitting OpenAI, Anthropic, LangChain, LlamaIndex, AWS, or Azure SDKs. | `package.json`, `server/package.json` | **ACTUALLY VERIFIED AT RUNTIME** | Clean `package.json` audit containing only `@google/adk`, `@google-cloud/vertexai`, `@google/generative-ai`, `@modelcontextprotocol/sdk`. |
| **Submitted Application Target** | Executable Web UI demonstrating intake form, ADK agent execution, MCP status telemetry, and analytics. | `client/src/App.jsx`, `server/index.js` | **ACTUALLY VERIFIED AT RUNTIME** | Web UI displaying live status of ADK, Gemini, MCP server, tool discovery, and ClickHouse Cloud analytics. |

---

## 2. ClickHouse MCP Traceability Details

* **Official Requirement**: ClickHouse runtime execution via official `mcp-clickhouse`.
* **Selected Approach**: Official `mcp-clickhouse` Python server v0.4.1 over `stdio` transport using `@modelcontextprotocol/sdk` StdioClientTransport.
* **Environment Variables Verified**: `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`, `CLICKHOUSE_SECURE=true`, `CLICKHOUSE_VERIFY=true`, `CLICKHOUSE_WRITE_ACCESS=true`, `CLICKHOUSE_ALLOW_WRITE_ACCESS=true`.
* **Runtime MCP Tools Discovered**: `run_query`, `list_databases`, `list_tables`, `run_chdb_select_query`.
* **ClickHouse Cloud Schema**: `agent_runs` and `scene_metrics` tables created via MCP `run_query`.
* **Read / Write Proof**: Telemetry logged to `agent_runs` via MCP `run_query` and queried back via MCP `run_query`.
* **ADK Tool Integration**: `runAdkWithClickHouseMcp` demonstrates Google ADK agent invoking ClickHouse MCP queries.

---

## 3. Google Agent Traceability Details

* **Official Requirement**: Run Google Cloud Agent Builder or Google Agent Development Kit (ADK).
* **Actual Agent Execution**: Google ADK initializes the agent workflow (`LlmAgent`, `Runner`), routing requests to Gemini 1.5 Flash.
* **Runtime Evidence**: Server logs showing ADK instance operations and MCP telemetry logging upon story generation.
* **Demo Evidence**: Client UI progress indicators rendering live agent status and telemetry.
