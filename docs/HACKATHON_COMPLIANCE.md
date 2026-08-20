# HACKATHON COMPLIANCE AUDIT & RUNTIME GUARANTEES

## 1. Hackathon Rules & Compliance Strategy

| Category | Hackathon Rule / Requirement | CineAgent Studio Compliance Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Primary AI Engine** | Must run on Google Cloud AI (Gemini 1.5/2.0) and Google Agent Development Kit (ADK). | Orchestration and story generation are defined as native Google ADK agents using `@google/adk`. | **ACTUALLY VERIFIED AT RUNTIME** |
| **Partner Track Requirement** | Must use ClickHouse at runtime via the official ClickHouse MCP server (`mcp-clickhouse`). | Node backend connects to official `mcp-clickhouse` 0.4.1 server via `@modelcontextprotocol/sdk` StdioClientTransport, invoking `run_query` to log telemetry and query analytics. | **ACTUALLY VERIFIED AT RUNTIME** |
| **Prohibited Technology** | Strict ban on OpenAI, Anthropic, AWS Bedrock, Azure OpenAI, LangChain, LlamaIndex, or non-Google LLM frameworks. | Zero dependency or configuration mappings for third-party LLMs. Explicit usage of `@google/adk` and `@modelcontextprotocol/sdk`. | **ACTUALLY VERIFIED AT RUNTIME** |
| **Demonstrable Artifacts** | Open-source public repository, English submission, max 3-minute video showing runtime integration. | Public GitHub repository containing runtime MCP connection files, unit/integration tests, and Web UI demo. | **DOCUMENTED & READY** |

---

## 2. ClickHouse MCP Server Runtime Verification

* **Official MCP Server**: The backend spawns `mcp-clickhouse` (v0.4.1 PyPI release, FastMCP based).
* **Write Access Configuration**: Configured with `CLICKHOUSE_WRITE_ACCESS=true` and `CLICKHOUSE_ALLOW_WRITE_ACCESS=true`.
* **No Direct Driver Bypass**: All Partner integration database operations execute strictly through MCP `run_query`.
* **Runtime Data Binding**:
  - Story Agent execution generates structured story packages.
  - Telemetry is automatically written to `agent_runs` on ClickHouse Cloud via MCP `run_query`.
  - Production analytics are queried from ClickHouse Cloud via MCP `run_query` and rendered in the React Web UI.

---

## 3. Strict Development vs. Runtime Delineation

* **Antigravity (Development IDE Assistant)**: Used only as the pair-programming assistant to build code, document design patterns, and verify code.
* **Web UI Infrastructure**: React + Vite frontend communicating with local Node.js Express server acting as the gateway client.
* **Google Agent Runtime**: Built on Google ADK (`LlmAgent`, `Runner`) executing Gemini models and connecting to ClickHouse MCP.
