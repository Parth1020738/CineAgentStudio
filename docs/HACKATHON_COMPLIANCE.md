# HACKATHON COMPLIANCE AUDIT & RUNTIME GUARANTEES

## 1. Hackathon Rules & Compliance Strategy

| Category | Hackathon Rule / Requirement | CineAgent Studio Compliance Implementation Strategy |
| :--- | :--- | :--- |
| **Primary AI Engine** | Must run on Google Cloud AI (Gemini 1.5/2.0) and Google Cloud Agent Builder / Google Agent Development Kit (ADK). | Orchestration and agent executions are defined as native Google ADK agents using the ADK SDK. |
| **Partner Track Requirement** | Must use ClickHouse at runtime via the official ClickHouse MCP server (`mcp-clickhouse`) to a ClickHouse Cloud or self-hosted cluster. | The Google ADK Agent Orchestrator connects to the `mcp-clickhouse` server host, invoking database tool schemas to write film production telemetry and read live metrics. |
| **Prohibited Technology** | Strict ban on OpenAI, Anthropic, AWS Bedrock/AI, Azure OpenAI, or non-Google LLM dependencies. | Zero dependency or configuration mappings for third-party LLMs. Explicit usage of `@google-cloud/vertexai` and Google ADK. |
| **Demonstrable Artifacts** | Open-source public repository, English submission, max 3-minute video showing runtime integration. | Public GitHub repository containing runtime MCP connection files, configuration files, and Web UI demo. |

---

## 2. ClickHouse MCP Server Runtime Verification

* **Official MCP Server**: The backend hosts and runs `mcp-clickhouse` (Model Context Protocol). 
* **Runtime Data Binding**:
  - Gemini agents declare and discover `mcp-clickhouse` tools.
  - Scene budget estimates and latency telemetry are stored using the `mcp-clickhouse` write/query tools.
  - Web UI reads analytics dashboards through queries executed by the MCP server client.

---

## 3. Strict Development vs. Runtime Delineation

* **Antigravity (Development IDE Assistant)**: Used only as the pair-programming assistant to build code, document design patterns, and verify directories. No Antigravity code will run in production.
* **Web UI Infrastructure**: React + Vite frontend communicating with our local Node.js Express server acting as the gateway client to the Google ADK runtime.
* **Google Agent Runtime**: Built on Google ADK / Agent Platform executing Gemini models and connecting to ClickHouse MCP.
