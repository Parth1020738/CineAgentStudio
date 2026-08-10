# Google Cloud Agent Platform & ADK Architecture

## 1. Native Google Agent Topology

The agentic pipeline is built on the Google Agent Development Kit (ADK) framework, ensuring runtime compliance.

```
                  ┌──────────────────────┐
                  │  Orchestrator Agent  │
                  └──────────┬───────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐        ┌─────────────┐
│ Story Agent  │       │ Screenplay   │        │ Budget      │
│ (ADK Config) │       │ Agent (ADK)  │        │ Agent (ADK) │
└──────────────┘       └──────────────┘        └─────────────┘
```

---

## 2. Component Design & Framework Integration

1. **Development Tools**:
   - Node.js setup, package files (`package.json`), environment scripts, and visual formatting libraries.
2. **Web Application Infrastructure**:
   - React application and Express gateway handling client requests.
3. **Google AI/Agent Runtime**:
   - The underlying core runtime configured with `@google-cloud/vertexai` or the Google ADK packages.
4. **Partner Integration**:
   - ClickHouse Model Context Protocol bindings allowing Google Agents to use the database as a tool.

---

## 3. Strict Reasoning Isolation

To adhere to safety guidelines:
* Standard logs and operational updates (e.g., "Screenplay Agent complete", "Writing budget metrics") are rendered on screen.
* Raw LLM thoughts, chain-of-thought steps, and system configurations are hidden from the UI logs.
