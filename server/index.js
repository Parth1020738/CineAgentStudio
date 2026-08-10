import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runStoryAgent } from './agents/storyAgent.js';
import { startClickHouseMcp, stopClickHouseMcp } from './mcp/clickhouseMcp.js';

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
  const hasHost = !!process.env.CLICKHOUSE_HOST;
  const hasPass = !!process.env.CLICKHOUSE_PASSWORD;

  if (!hasHost || !hasPass) {
    return res.json({
      status: 'disconnected',
      details: {
        mcpServerRunning: false,
        reason: 'Credentials missing in environment'
      }
    });
  }

  try {
    await startClickHouseMcp();
    res.json({
      status: 'connected',
      details: {
        mcpServerRunning: true,
        transport: 'stdio'
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

// Start Express gateway listener
const server = app.listen(PORT, () => {
  console.log(`CineAgent Studio backend server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  stopClickHouseMcp();
  server.close();
});
