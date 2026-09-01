# Phase 5D — CSV / Spreadsheet Export & Production Bible ZIP Specification

## 1. Executive Summary
Phase 5D adds CSV export formats, spreadsheet-compatible data streams (`BUDGET_XLSX`, `SCHEDULE_XLSX`), and complete **Production Bible ZIP archive generation** (`FULL_PRODUCTION_BIBLE_ZIP`) to **CineAgent Studio**. It packages all project assets (JSON schemas, PDFs, CSV spreadsheets) into a clean, relative ZIP archive ready for distribution to producers, department heads, and crew members.

---

## 2. CSV & Spreadsheet Export Formats

### 1. Breakdown CSV (`BREAKDOWN_CSV`)
Contains scene-level breakdown parameters:
Columns: `scene_number`, `scene_heading`, `location`, `interior_exterior`, `time_of_day`, `characters`, `extras_count`, `props`, `vehicles`, `wardrobe`, `makeup_fx`, `special_equipment`, `special_effects`, `vfx`, `production_complexity`, `estimated_cost`, `production_notes`.

### 2. Budget CSV & XLSX (`BUDGET_CSV`, `BUDGET_XLSX`)
Formatted with UTF-8 BOM (`\uFEFF`) for direct compatibility with Microsoft Excel, Apple Numbers, and Google Sheets:
- Section 1: Financial Overview Summary (Target Budget, Estimated Total Cost, Status, Variance).
- Section 2: Line-Item Budget Categories (Category Name, Estimated Cost, Explanation).
- Section 3: Scene-Linked Costs (Scene Number, Scene Heading, Estimated Cost).

### 3. Schedule CSV & XLSX (`SCHEDULE_CSV`, `SCHEDULE_XLSX`)
Formatted with one row per scheduled scene:
Columns: `shooting_day`, `date_label`, `location`, `time_of_day`, `scene_number`, `cast`, `extras_count`, `estimated_day_cost`, `setup_notes`, `rationale`, `risks`.

---

## 3. Production Bible ZIP Archive (`FULL_PRODUCTION_BIBLE_ZIP`)

### Archive Structure
All entries are packaged inside a single safe, relative root folder:
```
<safe-project-slug>-production-bible/
  ├── production-package.json
  ├── story.json
  ├── screenplay.json
  ├── breakdown.json
  ├── budget.json
  ├── schedule.json
  ├── insights.json
  ├── screenplay.pdf
  ├── budget.pdf
  ├── schedule.pdf
  ├── breakdown.csv
  ├── budget.csv
  └── schedule.csv
```

---

## 4. API Contract (`POST /api/export`)

| Export Type Enum | Response Content-Type | Output Filename |
| :--- | :--- | :--- |
| `BREAKDOWN_CSV` | `text/csv; charset=utf-8` | `<slug>-breakdown.csv` |
| `BUDGET_CSV` | `text/csv; charset=utf-8` | `<slug>-budget.csv` |
| `SCHEDULE_CSV` | `text/csv; charset=utf-8` | `<slug>-schedule.csv` |
| `BUDGET_XLSX` | `text/csv; charset=utf-8` | `<slug>-budget.csv` |
| `SCHEDULE_XLSX` | `text/csv; charset=utf-8` | `<slug>-schedule.csv` |
| `FULL_PRODUCTION_BIBLE_ZIP` | `application/zip` | `<slug>-production-bible.zip` |

---

## 5. Security & Path Traversal Prevention
* **Relative ZIP Paths**: All archive file entries are prefixed with `<safe-project-slug>-production-bible/` and contain no leading slashes or `..` path traversal characters.
* **Secret Sanitization**: All bundled JSON, CSV, and PDF files undergo recursive credential sanitization via `sanitizeExportPayload`. Zero API keys or database passwords exist in the archive.

---

## 6. Demo Mode vs Live Mode Behavior
* **Demo Mode (`CINEAGENT_DEMO_MODE=true`)**: Generates CSV and full Production Bible ZIP packages from offline demo fixtures in **<100ms** without Gemini or ClickHouse calls.
* **Live Mode (`CINEAGENT_DEMO_MODE=false`)**: Bundles already generated production plan assets without re-running LLM agents.

---

## 7. Verification & Test Results
* **Unit Tests**: 236 passing unit tests (18 dedicated Phase 5D tests).
* **ZIP Inspection**: Verified PK magic header (`PK\x03\x04`), archive file entry list, relative file paths, and uncorrupted internal PDF/JSON/CSV contents.
* **Client Build**: Production client bundle compiled cleanly in 150ms.
