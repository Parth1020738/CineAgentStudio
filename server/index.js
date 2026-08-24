import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runStoryAgent, runAdkWithClickHouseMcp } from './agents/storyAgent.js';
import { runStoryToScreenplayPipeline, runFullProductionPipeline } from './agents/pipeline.js';
import {
  recordProductionAnalytics,
  getProjectProductionSummary,
  getHighestCostScenes,
  getCostByLocation,
  getCostByCategory,
  getComplexityDistribution,
  getCastLoadByScene,
  getMajorCostDrivers
} from './services/productionAnalytics.js';
import {
  initMcpClient,
  listMcpTools,
  validateClickHouseConfig,
  getAgentRunAnalytics,
  ensureCineAgentSchema,
  executeMcpQuery,
  stopMcpClient
} from './mcp/clickhouseMcp.js';
import { logGeminiConfig, is429RateLimitError } from './config/geminiConfig.js';
import { isDemoModeEnabled, getDemoProductionPlan } from './fixtures/demoFixtures.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-process request throttling guard for production-plan endpoint
const activeProductionPlanRequests = new Set();

// Health status endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', demoMode: isDemoModeEnabled(), timestamp: new Date() });
});

// ADK System status checks
app.get('/api/agent/health', (req, res) => {
  const hasKey = !!process.env.GOOGLE_GENAI_API_KEY;
  const demoMode = isDemoModeEnabled();
  res.json({
    status: (hasKey || demoMode) ? 'healthy' : 'degraded',
    details: {
      googleAdkInitialized: true,
      geminiConnected: hasKey,
      demoModeEnabled: demoMode
    }
  });
});

// Trigger Story Agent execution
app.post('/api/story', async (req, res) => {
  const { title, genre, logline, tone, targetBudget } = req.body;

  if (!title || !genre || !logline) {
    return res.status(400).json({ error: 'Missing required fields: title, genre, logline' });
  }

  if (isDemoModeEnabled()) {
    console.log('[Demo Mode] Returning demo story package.');
    const demoPlan = getDemoProductionPlan(req.body);
    return res.json({ status: 'success', data: demoPlan.storyPackage });
  }

  try {
    const result = await runStoryAgent({ title, genre, logline, tone, targetBudget });
    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Story Agent generation failed:', error);
    if (error.code === 'GEMINI_RATE_LIMITED' || is429RateLimitError(error)) {
      return res.status(429).json({
        error: 'GEMINI_RATE_LIMITED',
        message: 'Gemini daily limit reached. Please wait for the quota to reset and try again.'
      });
    }
    res.status(500).json({ error: 'Failed to generate story package.', details: error.message });
  }
});

// Trigger full Multi-Agent Story -> Screenplay Production Pipeline
app.post('/api/pipeline/story-to-screenplay', async (req, res) => {
  const { title, genre, logline, tone, targetBudget, projectId } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string.' });
  }
  if (!genre || typeof genre !== 'string' || !genre.trim()) {
    return res.status(400).json({ error: 'Genre is required and must be a non-empty string.' });
  }
  if (!logline || typeof logline !== 'string' || !logline.trim()) {
    return res.status(400).json({ error: 'Logline is required and must be a non-empty string.' });
  }

  if (isDemoModeEnabled()) {
    console.log('[Demo Mode] Returning demo story-to-screenplay pipeline result.');
    const demoPlan = getDemoProductionPlan(req.body);
    return res.json({
      status: 'success',
      data: {
        projectId: demoPlan.projectId,
        storyPackage: demoPlan.storyPackage,
        screenplay: demoPlan.screenplay,
        pipelineTelemetry: demoPlan.pipelineTelemetry
      }
    });
  }

  try {
    const pipelineResult = await runStoryToScreenplayPipeline({
      title: title.trim(),
      genre: genre.trim(),
      logline: logline.trim(),
      tone: tone ? String(tone).trim() : 'Cinematic',
      targetBudget: targetBudget ? String(targetBudget).trim() : '5000000',
      projectId: projectId ? String(projectId).trim() : undefined
    });

    res.json({
      status: 'success',
      data: {
        projectId: pipelineResult.storyPackage?.telemetry?.projectId || pipelineResult.screenplay?.project_id || 'default_project',
        storyPackage: pipelineResult.storyPackage,
        screenplay: pipelineResult.screenplay,
        pipelineTelemetry: pipelineResult.pipelineTelemetry
      }
    });
  } catch (error) {
    console.error('[Pipeline Endpoint Error]:', error);
    if (error.code === 'GEMINI_RATE_LIMITED' || is429RateLimitError(error)) {
      return res.status(429).json({
        error: 'GEMINI_RATE_LIMITED',
        message: 'Gemini daily limit reached. Please wait for the quota to reset and try again.'
      });
    }
    res.status(500).json({
      error: 'Multi-Agent Production Pipeline execution failed.',
      message: error.message || 'An unexpected error occurred during pipeline execution.'
    });
  }
});

// Trigger full 5-Agent Production Planning Pipeline (Story -> Screenplay -> Breakdown -> Budget -> Schedule -> ClickHouse Analytics)
app.post('/api/pipeline/production-plan', async (req, res) => {
  const { title, genre, logline, tone, targetBudget, targetShootDays, projectId } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string.' });
  }
  if (!genre || typeof genre !== 'string' || !genre.trim()) {
    return res.status(400).json({ error: 'Genre is required and must be a non-empty string.' });
  }
  if (!logline || typeof logline !== 'string' || !logline.trim()) {
    return res.status(400).json({ error: 'Logline is required and must be a non-empty string.' });
  }

  if (isDemoModeEnabled()) {
    console.log('[Demo Mode] Serving deterministic local demo production plan payload.');
    const demoData = getDemoProductionPlan(req.body);
    return res.json({ status: 'success', data: demoData });
  }

  const lockKey = `${title.trim()}_${genre.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (activeProductionPlanRequests.has(lockKey)) {
    return res.status(429).json({
      error: 'GEMINI_RATE_LIMITED',
      message: 'A production plan generation is already in progress for this concept. Please wait for it to complete.'
    });
  }

  activeProductionPlanRequests.add(lockKey);

  try {
    const pipelineResult = await runFullProductionPipeline({
      title: title.trim(),
      genre: genre.trim(),
      logline: logline.trim(),
      tone: tone ? String(tone).trim() : 'Cinematic',
      targetBudget: targetBudget ? String(targetBudget).trim() : '5000000',
      targetShootDays: targetShootDays ? String(targetShootDays).trim() : undefined,
      projectId: projectId ? String(projectId).trim() : undefined
    });

    const safeProjectId = pipelineResult.breakdown?.project_id || pipelineResult.budget?.project_id || pipelineResult.schedule?.project_id || 'default_project';

    let productionInsights = null;
    try {
      if (validateClickHouseConfig()) {
        const [
          summary,
          highestCostScenes,
          costByLocation,
          costByCategory,
          complexityDistribution,
          castLoadByScene,
          majorCostDrivers
        ] = await Promise.all([
          getProjectProductionSummary(safeProjectId).catch(() => null),
          getHighestCostScenes(safeProjectId, 5).catch(() => []),
          getCostByLocation(safeProjectId).catch(() => []),
          getCostByCategory(safeProjectId).catch(() => []),
          getComplexityDistribution(safeProjectId).catch(() => []),
          getCastLoadByScene(safeProjectId).catch(() => []),
          getMajorCostDrivers(safeProjectId).catch(() => [])
        ]);

        productionInsights = {
          summary,
          highestCostScenes,
          costByLocation,
          costByCategory,
          complexityDistribution,
          castLoadByScene,
          majorCostDrivers,
          clickHouseConnected: true
        };
      }
    } catch (insightsErr) {
      console.warn(`[Production Plan Endpoint] Analytics fetch warning: ${insightsErr.message}`);
      productionInsights = { clickHouseConnected: false, error: 'Analytics temporarily unavailable' };
    }

    res.json({
      status: 'success',
      data: {
        projectId: safeProjectId,
        title: pipelineResult.breakdown?.title || title,
        storyPackage: pipelineResult.storyPackage,
        screenplay: pipelineResult.screenplay,
        breakdown: pipelineResult.breakdown,
        budget: pipelineResult.budget,
        schedule: pipelineResult.schedule,
        productionInsights,
        pipelineTelemetry: pipelineResult.pipelineTelemetry
      }
    });
  } catch (error) {
    console.error('[Production Plan Endpoint Error]:', error);
    if (error.code === 'GEMINI_RATE_LIMITED' || is429RateLimitError(error)) {
      return res.status(429).json({
        error: 'GEMINI_RATE_LIMITED',
        message: 'Gemini is temporarily rate-limited. Please wait a short time and try again.'
      });
    }
    res.status(500).json({
      error: 'Production Planning Pipeline execution failed.',
      message: error.message || 'An unexpected error occurred during production planning execution.'
    });
  } finally {
    activeProductionPlanRequests.delete(lockKey);
  }
});

// Query ClickHouse Production Analytics on demand
app.get('/api/pipeline/production-insights/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required.' });
  }

  if (!validateClickHouseConfig()) {
    return res.status(503).json({ error: 'ClickHouse analytics service unavailable.' });
  }

  try {
    const [
      summary,
      highestCostScenes,
      costByLocation,
      costByCategory,
      complexityDistribution,
      castLoadByScene,
      majorCostDrivers
    ] = await Promise.all([
      getProjectProductionSummary(projectId),
      getHighestCostScenes(projectId, 5),
      getCostByLocation(projectId),
      getCostByCategory(projectId),
      getComplexityDistribution(projectId),
      getCastLoadByScene(projectId),
      getMajorCostDrivers(projectId)
    ]);

    res.json({
      status: 'success',
      data: {
        projectId,
        summary,
        highestCostScenes,
        costByLocation,
        costByCategory,
        complexityDistribution,
        castLoadByScene,
        majorCostDrivers,
        clickHouseConnected: true
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch production insights.', details: err.message });
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
  logGeminiConfig();
});

process.on('SIGTERM', async () => {
  await stopMcpClient();
  server.close();
});

process.on('SIGINT', async () => {
  await stopMcpClient();
  server.close();
});
