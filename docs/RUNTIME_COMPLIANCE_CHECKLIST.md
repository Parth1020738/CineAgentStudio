# RUNTIME COMPLIANCE CHECKLIST

## 1. Compliance Checklist For Judges

Before submission, verify that every item on this list is fully compliant:

- [ ] **No Prohibited AI Frameworks**:
  - Run search/grep audits on `package.json` to ensure zero presence of `openai`, `anthropic`, or `@aws-sdk/client-bedrock`.
- [ ] **Google ADK Initialization**:
  - Inspect backend startup files for Google ADK configuration classes and initializations.
- [ ] **ClickHouse MCP Server Running**:
  - Verify that the `mcp-clickhouse` server process starts successfully, establishing standard connection pipes to the primary backend gateway.
- [ ] **Runtime Database Tools**:
  - Confirm that agent tools register ClickHouse query configurations, executing actual inserts and lookups at runtime.
- [ ] **Safe UI Outputs**:
  - Inspect React UI rendering templates to guarantee that only safe statuses (and no raw chain-of-thought files or inner LLM steps) are displayed on the frontend dashboard.
- [ ] **Clean Git Workspace**:
  - Verify that no private environment configuration keys are committed.
