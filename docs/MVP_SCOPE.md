# MVP Scope & Phased Implementation

## 1. Minimum Viable Product (MVP)

The MVP scope defines the boundaries of the initial production release, ensuring we implement all required features without scope creep.

### Core Pipelines:
* **Film Concept Intake Form**: Capture user inputs (Genre, Title, Target Budget, Style/Tone).
* **Sequential Google ADK Agent Executions**:
  - **Story Agent**: Generates 3-act summary, character outlines.
  - **Screenplay Agent**: Formats 2 complete screenplay scenes.
  - **Budget Agent**: Analyzes scenes for cost items.
  - **Schedule Agent**: Creates a 3-day production timeline.
* **ClickHouse MCP Telemetry**:
  - Live writing of token metadata, execution latency, scene details, and costs to ClickHouse Cloud via `mcp-clickhouse`.
  - Visual charts rendering these stats in the Web UI.
* **Production Bible Export**: Markdown summary of all generated components.

---

## 2. Excluded Features (Phase 2 Roadmap)

The following capabilities are explicitly deferred to ensure MVP delivery:
* ❌ **Script Doctor**: No interactive rewrites.
* ❌ **Imagen Storyboards**: No image generation.
* ❌ **Google Maps Integration**: No location geo-mapping.
* ❌ **Multi-user Collaboration**: No live websockets for editing rooms.
