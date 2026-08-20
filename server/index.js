import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runStoryAgent, runAdkWithClickHouseMcp } from './agents/storyAgent.js';
import {
  initMcpClient,
  listMcpTools,
  validateClickHouseConfig,
  getAgentRunAnalytics,
  ensureCineAgentSchema,
  executeMcpQuery,
  stopMcpClient
} from './mcp/clickhouseMcp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health status endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ADK System status checks
app.get('/api/agent/health', (req, res) => {
  const hasKey = !!process.env.GOOGLE_GENAI_API_KEY;
  res.json({
    status: hasKey ? 'healthy' : 'degraded',
    details: {
      googleAdkInitialized: true,
      geminiConnected: hasKey
    }
  });
});

// Trigger Story Agent execution
app.post('/api/story', async (req, res) => {
  const { title, genre, logline, tone, targetBudget } = req.body;

  if (!title || !genre || !logline) {
    return res.status(400).json({ error: 'Missing required fields: title, genre, logline' });
  }

  try {
    const result = await runStoryAgent({ title, genre, logline, tone, targetBudget });
    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Story Agent generation failed:', error);
    res.status(500).json({ error: 'Failed to generate story package.', details: error.message });
  }
});

// MCP Connection checks
app.get('/api/mcp/health', async (req, res) => {
  if (!validateClickHouseConfig()) {
    return res.json({
      status: 'disconnected',
      details: {
        mcpServerRunning: false,
        reason: 'Credentials missing in environment (CLICKHOUSE_HOST and CLICKHOUSE_PASSWORD required)'
      }
    });
  }

  try {
    const initResult = await initMcpClient();
    res.json({
      status: 'connected',
      details: {
        mcpServerRunning: true,
        transport: 'stdio',
        serverPackage: 'mcp-clickhouse (Python PyPI)',
        tools: initResult.tools
      }
    });
  } catch (err) {
    res.json({
      status: 'error',
      details: {
        mcpServerRunning: false,
        error: err.message
      }
    });
  }
});

// MCP Analytics endpoint
app.get('/api/mcp/analytics', async (req, res) => {
  if (!validateClickHouseConfig()) {
    return res.status(400).json({ error: 'ClickHouse configuration missing in environment.' });
  }

  try {
    await ensureCineAgentSchema();
    const projectId = req.query.projectId || '';
    const analytics = await getAgentRunAnalytics(projectId);
    res.json({
      status: 'success',
      source: 'mcp-clickhouse (run_query)',
      analytics: analytics.result,
      durationMs: analytics.durationMs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query analytics via MCP.', details: err.message });
  }
});

// Google ADK -> MCP interaction test endpoint
app.post('/api/adk-mcp-test', async (req, res) => {
  if (!validateClickHouseConfig()) {
    return res.status(400).json({ error: 'ClickHouse configuration missing in environment.' });
  }

  try {
    const projectId = req.body.projectId || 'test_project';
    await ensureCineAgentSchema();
    const adkMcpResult = await runAdkWithClickHouseMcp(projectId);
    res.json({ status: 'success', data: adkMcpResult });
  } catch (err) {
    res.status(500).json({ error: 'Failed ADK -> MCP interaction test.', details: err.message });
  }
});

// Start Express gateway listener
const server = app.listen(PORT, () => {
  console.log(`CineAgent Studio backend server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await stopMcpClient();
  server.close();
});

process.on('SIGINT', async () => {
  await stopMcpClient();
  server.close();
});
