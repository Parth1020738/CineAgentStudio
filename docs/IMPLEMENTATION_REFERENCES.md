# Hackathon Implementation References

## 1. Google Agent Development Kit (ADK) Reference

* **Official NPM Package**: `@google/adk`
* **Development CLI Package**: `@google/adk-devtools`
* **Official Model Namespace**: Uses models via `@google/generative-ai` or `@google-cloud/vertexai` configurations.
* **Environment Variable**: `GOOGLE_GENAI_API_KEY` (or Vertex AI equivalents).

---

## 2. ClickHouse MCP (Model Context Protocol) Reference

* **Official Python Package**: `mcp-clickhouse`
* **GitHub Repository**: [ClickHouse/mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
* **Execution Command (via uv)**:
  ```bash
  uv run --with mcp-clickhouse mcp-clickhouse
  ```
  Or via standard python module loader after pip installing `mcp-clickhouse`.
* **Required Environment Variables**:
  - `CLICKHOUSE_HOST`
  - `CLICKHOUSE_PORT`
  - `CLICKHOUSE_USER`
  - `CLICKHOUSE_PASSWORD`
  - `CLICKHOUSE_SECURE`
  - `CLICKHOUSE_ALLOW_WRITE_ACCESS=true`
* **Exposed Model Tools**:
  - `clickhouse_query`: Runs standard read/write queries.
  - `clickhouse_show_tables`: Lists schema structure.
