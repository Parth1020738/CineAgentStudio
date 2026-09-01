# CineAgent Studio — Phase 6B Production Deployment Guide

PRIMARY DEPLOYMENT TARGET = RENDER FREE WEB SERVICE

> Note: Render Free Web Service is the primary, zero-cost deployment target for CineAgent Studio (requiring no credit card or paid cloud billing). Google Cloud Run is documented as an optional alternative only.

## 1. Overview & Architecture

CineAgent Studio is deployed using a streamlined **single-service container architecture** (compatible with Render Free Web Service and Google Cloud Run).

```
[Browser Client]
       │ (Public HTTPS GET / POST)
       ▼
[Render Free Web Service / Cloud Run Container]
       ├── Express Gateway (Node.js listening on process.env.PORT, bound to 0.0.0.0)
       ├── Compiled React Static Assets (client/dist)
       ├── Google ADK + Gemini API (gemini-3.1-flash-lite)
       └── Python Subprocess (mcp_clickhouse.main via StdioClientTransport)
               │
               ▼
       [ClickHouse Cloud]
```

### Key Architectural Advantages
1. **Same-Origin API Routing**: React frontend serves from Express on the same origin (`/api/...`), eliminating cross-origin CORS complexity and hardcoded localhost backend URLs.
2. **Preserved MCP Stdio Architecture**: Container includes Python runtime with `mcp-clickhouse` PyPI package, launching standard stdio transport directly inside the container without replacing official MCP drivers.
3. **Zero Cost on Render Free Tier**: Runs 100% free without paid cloud billing or credit card setup.
4. **Stateless Autoscaling**: Scales seamlessly based on incoming HTTP request volume.

---

## 2. Container Build & Local Validation (`Dockerfile`)

### Dockerfile Strategy
Multi-stage build separating React compilation from the lightweight production runtime:
- **Stage 1 (`client-builder`)**: Uses `node:20-alpine` to install dependencies and execute `npm run build` for the client.
- **Stage 2 (`runtime`)**: Uses `node:20-slim`, installs Python 3, `pip3`, `mcp-clickhouse`, production Node dependencies, server source, and compiled `client/dist`.

### Local Container Verification Commands

```bash
# 1. Build Production Docker Image Locally
docker build -t cineagent-studio:latest .

# 2. Test Container Locally in Offline Demo Mode
docker run -p 8080:8080 -e CINEAGENT_DEMO_MODE=true cineagent-studio:latest

# 3. Test Container Health & Root Endpoints
curl http://localhost:8080/health
# Output: {"status":"ok","demoMode":true,"timestamp":"..."}

curl http://localhost:8080/api/agent/health
```

---

## 3. Secret Management & Cloud Environment Configuration

Sensitive credentials MUST NOT be hardcoded into container images or checked into Git. Use **Google Cloud Secret Manager**.

### Secret Manager Resources
- `GOOGLE_GENAI_API_KEY`: Secret containing the Gemini API Key.
- `CLICKHOUSE_PASSWORD`: Secret containing the ClickHouse Cloud database password.

### Environment Variables
| Variable | Value / Source | Secret Manager | Description |
|---|---|---|---|
| `PORT` | `8080` | No | Injected automatically by Cloud Run |
| `NODE_ENV` | `production` | No | Enables production optimizations |
| `CINEAGENT_DEMO_MODE` | `false` | No | Enables live multi-agent pipeline |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | No | Configures active Gemini model |
| `GOOGLE_GENAI_API_KEY` | `projects/PROJECT_ID/secrets/GOOGLE_GENAI_API_KEY/versions/latest` | **YES** | Mounted into container at runtime |
| `CLICKHOUSE_HOST` | `your_clickhouse_host.clickhouse.cloud` | No | Remote ClickHouse host |
| `CLICKHOUSE_PORT` | `8443` | No | ClickHouse native TLS port |
| `CLICKHOUSE_USER` | `default` | No | ClickHouse database user |
| `CLICKHOUSE_PASSWORD` | `projects/PROJECT_ID/secrets/CLICKHOUSE_PASSWORD/versions/latest` | **YES** | Mounted into container at runtime |
| `CLICKHOUSE_DATABASE` | `default` | No | ClickHouse database name |
| `CLICKHOUSE_SECURE` | `true` | No | Enforces TLS encryption |
| `CLICKHOUSE_WRITE_ACCESS` | `true` | No | Enables telemetry schema writes |

---

## 4. Google Cloud Run Deployment Commands

```bash
# 1. Set Google Cloud Project & Region
export GCP_PROJECT="your-gcp-project-id"
export GCP_REGION="us-central1"
export SERVICE_NAME="cineagent-studio"
export ARTIFACT_REPO="cineagent-repo"

gcloud config set project $GCP_PROJECT

# 2. Create Artifact Registry Repository (if not existing)
gcloud artifacts repositories create $ARTIFACT_REPO \
    --repository-format=docker \
    --location=$GCP_REGION \
    --description="Docker repository for CineAgent Studio"

# 3. Build & Push Image using Cloud Build
gcloud builds submit --tag $GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$ARTIFACT_REPO/$SERVICE_NAME:latest .

# 4. Deploy to Google Cloud Run with Secret Manager Integration
gcloud run deploy $SERVICE_NAME \
    --image=$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$ARTIFACT_REPO/$SERVICE_NAME:latest \
    --region=$GCP_REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300s \
    --min-instances=0 \
    --max-instances=5 \
    --set-env-vars="NODE_ENV=production,CINEAGENT_DEMO_MODE=false,GEMINI_MODEL=gemini-3.1-flash-lite,CLICKHOUSE_HOST=u2p05autaa.asia-northeast1.gcp.clickhouse.cloud,CLICKHOUSE_PORT=8443,CLICKHOUSE_USER=default,CLICKHOUSE_DATABASE=default,CLICKHOUSE_SECURE=true,CLICKHOUSE_WRITE_ACCESS=true,CLICKHOUSE_ALLOW_WRITE_ACCESS=true" \
    --set-secrets="GOOGLE_GENAI_API_KEY=GOOGLE_GENAI_API_KEY:latest,CLICKHOUSE_PASSWORD=CLICKHOUSE_PASSWORD:latest"
```

---

## 5. Public Runtime Verification Checklist

Once Cloud Run outputs the public URL (e.g., `https://cineagent-studio-xyz-uc.a.run.app`):

1. **Health Verification**:
   ```bash
   curl https://cineagent-studio-xyz-uc.a.run.app/health
   # Returns 200 OK
   ```
2. **Frontend UI Verification**:
   - Open public URL in browser.
   - Verify intake form, story package viewer, screenplay viewer, breakdown, budget, schedule, insights, and export tabs render cleanly.
3. **Deterministic Export Verification**:
   - Trigger Production Bible ZIP download.
   - Verify binary download completes without Gemini or ClickHouse API calls.
4. **Live Pipeline Execution**:
   - Submit new film concept.
   - Verify Story -> Screenplay -> Breakdown -> Budget -> Schedule -> ClickHouse MCP flow completes.

---

## 6. Troubleshooting & Rollback Procedure

### Troubleshooting
- **Cloud Run Startup Timeout**: Ensure `PORT` defaults to `8080` and `app.listen(PORT)` is called.
- **Python / MCP Process Error**: Verify `pip3 install --break-system-packages mcp-clickhouse` installed cleanly in container.
- **429 Gemini Rate Limit**: App handles 429 automatically by failing fast with user-friendly notification `GEMINI_RATE_LIMITED`.

### Rollback Procedure
If a deployment exhibits unexpected runtime issues, rollback immediately to the previous revision:

```bash
# List Cloud Run service revisions
gcloud run revisions list --service=$SERVICE_NAME --region=$GCP_REGION

# Route 100% traffic to previous healthy revision
gcloud run services update-traffic $SERVICE_NAME \
    --region=$GCP_REGION \
    --to-revisions=PREVIOUS_REVISION_NAME=100
```
