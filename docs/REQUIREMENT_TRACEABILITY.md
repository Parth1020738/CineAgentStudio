# REQUIREMENT TRACEABILITY MATRIX

## 1. Compliance Mapping Table

| Hackathon Rule / Requirement | CineAgent Studio Implementation | File / Module | Runtime Call Evidence | Judge Verification / Demo Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Must use ClickHouse at runtime via official MCP** | ClickHouse database interaction managed via local `mcp-clickhouse` server process. | `server/mcp/clickhouseMcp.js`, `server/config/mcpConfig.json` | JSON-RPC calls sent via stdin/stdout or SSE to the `mcp-clickhouse` server executing tool queries. | ClickHouse client queries logged in runtime shell; real-time dashboard displaying database entries in UI. |
| **Must use Gemini & Google Cloud Agent Builder / ADK** | Pipeline orchestrated natively via Google ADK runtime and Gemini models. | `server/agents/orchestrator.js`, `server/agents/adkConfig.js` | Direct calls through `@google-cloud/vertexai` or `@google/generative-ai` SDK. | Console startup showing initialization of Google ADK system; UI displaying step completion. |
| **Zero Prohibited AI Engines** | Strict dependency constraints omitting OpenAI, Anthropic, AWS, or Azure SDKs. | `package.json` | Empty dependency lists for third-party providers. | Auditable package dependency list. |
| **Submitted Application Target** | Fully executable Web UI demonstrating intake form, agents, and analytics. | `client/src/`, `server/index.js` | Web server serving UI and routing API requests to Google ADK runtime. | Screen capture of full client flow, clicking through pre-production generation. |

---

## 2. ClickHouse MCP Traceability Details

* **Official Requirement**: ClickHouse runtime execution via `mcp-clickhouse`.
* **Runtime MCP Call**: When the screenplay is analyzed, the Google ADK Orchestrator calls the ClickHouse MCP write tool to record scene details.
* **ClickHouse Cloud**: Active connection string pointing to ClickHouse Cloud URL.
* **Returned Analytics**: Real-time analytical queries return budget allocations.
* **Visible UI Evidence**: High-tech charts rendering analytical metrics from ClickHouse Cloud.

---

## 3. Google Agent Traceability Details

* **Official Requirement**: Run Google Cloud Agent Builder or Google Agent Development Kit (ADK).
* **Actual Agent Execution**: Google ADK initializes the agent workflow, routing requests to Gemini models.
* **Gemini**: Core text models (Gemini 1.5 Flash/Pro) perform logical generations.
* **Runtime Evidence**: Server logs showing ADK instance operations.
* **Demo Evidence**: UI progress indicators rendering state completions.
