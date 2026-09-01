# CineAgent Studio — Render Free Web Service Deployment Guide 🚀

This document provides step-by-step instructions for deploying CineAgent Studio as a **Free Web Service** on **Render** (no credit card or paid billing required).

---

## 🏗 Architecture Overview

The deployed application runs as a **single unified web service** on Render:

```
[Browser User]
       │ (HTTPS GET / POST)
       ▼
[Render Free Web Service Container]
       ├── Express Server (Node.js listening on process.env.PORT, bound to 0.0.0.0)
       ├── Built React Static Assets (client/dist) & SPA Route Fallback
       ├── Google ADK + Gemini API (gemini-3.1-flash-lite)
       └── Python Subprocess (mcp-clickhouse via StdioClientTransport)
               │
               ▼
       [ClickHouse Cloud]
```

---

## 🛠 Manual Render Dashboard Setup Instructions

### Step 1: Create a Render Account
1. Go to [https://render.com](https://render.com).
2. Sign up or log in (using GitHub or email). **No payment method / credit card is required** for Free Web Services.

### Step 2: Push Repository to GitHub
Ensure your repository is pushed to your GitHub account:
```bash
git add .
git commit -m "Prepare CineAgent Studio for Render deployment"
git push origin main
```

### Step 3: Create New Web Service on Render
1. In the Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository (`CineAgentStudio`).

### Step 4: Configure Web Service Settings
Fill in the deployment settings as follows:

| Setting | Configuration Value |
|---|---|
| **Name** | `cineagent-studio` (or your preferred service name) |
| **Region** | Oregon (US West) or Singapore (choose closest region) |
| **Branch** | `main` |
| **Root Directory** | Leave blank (root `/`) |
| **Environment / Runtime** | **Docker** |
| **Dockerfile Path** | `./Dockerfile` |
| **Docker Command** | Leave default (uses `CMD ["node", "server/index.js"]` from Dockerfile) |
| **Instance Type / Plan** | **Free** ($0 / month) |
| **Health Check Path** | `/health` |

---

## 🔑 Step 5: Environment Variables Setup

In the Render Dashboard under **Environment Variables**, add the following key-value pairs:

| Environment Variable Key | Value / Instructions | Required? |
|---|---|---|
| `CINEAGENT_DEMO_MODE` | `false` | Yes |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Yes |
| `GOOGLE_GENAI_API_KEY` | *Paste your real Gemini API key* | Yes |
| `CLICKHOUSE_HOST` | `u2p05autaa.asia-northeast1.gcp.clickhouse.cloud` (or your ClickHouse host) | Yes |
| `CLICKHOUSE_PORT` | `8443` | Yes |
| `CLICKHOUSE_USER` | `default` | Yes |
| `CLICKHOUSE_PASSWORD` | *Paste your real ClickHouse password* | Yes |
| `CLICKHOUSE_DATABASE` | `default` | Yes |
| `CLICKHOUSE_SECURE` | `true` | Yes |
| `CLICKHOUSE_WRITE_ACCESS` | `true` | Yes |
| `CLICKHOUSE_ALLOW_WRITE_ACCESS` | `true` | Yes |

*Note: Render automatically injects `PORT` into `process.env.PORT` during container runtime.*

---

## 🚀 Step 6: Deploy Web Service
Click **Create Web Service**.

Render will:
1. Pull your repository.
2. Build the multi-stage Docker image using `./Dockerfile`.
3. Compile the React frontend (`client/dist`).
4. Install Python 3, `pip3`, and `mcp-clickhouse`.
5. Install production Node dependencies.
6. Start `node server/index.js` on `process.env.PORT`.
7. Verify `/health` returns `200 OK`.

---

## 🧪 Step 7: Public Verification

Once deployed, Render provides a public HTTPS URL (e.g., `https://cineagent-studio.onrender.com`).

### 1. Health Verification
```bash
curl https://cineagent-studio.onrender.com/health
# Response: {"status":"ok","demoMode":false,"timestamp":"..."}
```

### 2. Frontend UI Verification
- Open `https://cineagent-studio.onrender.com` in your browser.
- Verify intake form, Story Package, Formatted Screenplay (`Courier Prime`), Breakdown, Budget, Schedule, Insights, and Export Workspace load properly.

### 3. Export System Verification
- Navigate to **Production Planning** → **Export Workspace**.
- Click **Download Production Bible**. Verify `.zip` archive downloads cleanly without Gemini or ClickHouse API calls.

---

## ⚡ Free Tier Limitations & Operational Behavior

- **Spin-Down on Inactivity**: Free Web Services on Render spin down automatically after **15 minutes of inactivity**.
- **Cold Start**: The next incoming request after spin-down will trigger a cold boot (takes ~30-50 seconds to start Node & Python processes).
- **Free Allowance**: 750 free instance hours per month (sufficient to run 1 free web service 24/7).
- **Zero Cost**: Render Free tier does not require or bill any credit card.

---

## 🔒 Security Summary

- All secrets (`GOOGLE_GENAI_API_KEY`, `CLICKHOUSE_PASSWORD`) are securely stored in Render environment variables and never baked into the Docker image or exposed to the client.
- `.env` files are excluded from git version control via `.gitignore`.
- React frontend communicates via same-origin `/api/...` endpoints, eliminating cross-origin CORS security risks and hardcoded localhost addresses.
