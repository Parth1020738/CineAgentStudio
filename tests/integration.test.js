import assert from 'assert';
import dotenv from 'dotenv';
import { runStoryAgent, runAdkWithClickHouseMcp } from '../server/agents/storyAgent.js';
import {
  initMcpClient,
  listMcpTools,
  executeMcpQuery,
  ensureCineAgentSchema,
  recordAgentRun,
  getAgentRunAnalytics,
  stopMcpClient,
  validateClickHouseConfig
} from '../server/mcp/clickhouseMcp.js';

dotenv.config();

describe('CineAgent Studio - Phase 2 Live Integration Tests', function() {
  this.timeout(45000); // 45 seconds for live external API & subprocess operations

  after(async function() {
    await stopMcpClient();
  });

  it('should test Story Agent execution against Gemini API', async function() {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn('[SKIP] GOOGLE_GENAI_API_KEY missing from environment. Skipping Gemini Story Agent live test.');
      this.skip();
      return;
    }

    const testInputs = {
      title: 'Neon Horizon',
      genre: 'Sci-Fi Cyberpunk',
      logline: 'A rogue AI is tracked down by its creator.',
      tone: 'Gritty, Neo-noir',
      targetBudget: '5000000'
    };

    const result = await runStoryAgent(testInputs);
    assert.strictEqual(typeof result.logline, 'string');
    assert.strictEqual(Array.isArray(result.characters), true);
  });

  it('should test ClickHouse MCP runtime path (init, tools, SELECT 1, schema, write, read, ADK)', async function() {
    if (!validateClickHouseConfig()) {
      console.warn('[SKIP] CLICKHOUSE_HOST or CLICKHOUSE_PASSWORD missing from environment. Skipping ClickHouse MCP live integration test.');
      this.skip();
      return;
    }

    // 1. MCP Initialization & Process Startup
    const initResult = await initMcpClient();
    assert.strictEqual(initResult.connected, true, 'MCP initialization handshake should succeed.');

    // 2. Tool Discovery Verification
    const tools = listMcpTools();
    console.log('[Test Verification] Discovered MCP Tools:', tools);
    assert.strictEqual(tools.includes('run_query'), true, 'run_query tool must be exposed.');
    assert.strictEqual(tools.includes('list_databases'), true, 'list_databases tool must be exposed.');
    assert.strictEqual(tools.includes('list_tables'), true, 'list_tables tool must be exposed.');

    // 3. Simple SELECT 1 query through MCP
    const select1Result = await executeMcpQuery('SELECT 1 AS test_val');
    assert.ok(select1Result, 'SELECT 1 query result must exist.');
    assert.ok(select1Result.durationMs >= 0, 'Query duration must be recorded.');

    // 4. CineAgent Schema Creation through MCP run_query
    await ensureCineAgentSchema();

    // 5. MCP Write Test (INSERT agent_runs record)
    const testRunId = `test_run_${Date.now()}`;
    const testProjectId = 'integration_test_project';
    const writeResult = await recordAgentRun({
      runId: testRunId,
      projectId: testProjectId,
      agentName: 'story_agent_test',
      status: 'TEST_SUCCESS',
      durationMs: 1200
    });
    assert.ok(writeResult, 'MCP recordAgentRun write operation must complete.');

    // 6. MCP Read Test (SELECT agent_runs record)
    const readResult = await getAgentRunAnalytics(testProjectId);
    assert.ok(readResult, 'MCP getAgentRunAnalytics read operation must complete.');
    assert.ok(readResult.result, 'Query result container must exist.');

    // 7. Google ADK Agent -> MCP Interaction Test
    const adkMcpResult = await runAdkWithClickHouseMcp(testProjectId);
    assert.strictEqual(adkMcpResult.adkAgent, 'story_agent');
    assert.strictEqual(adkMcpResult.mcpToolUsed, 'run_query');
    assert.ok(adkMcpResult.analytics, 'Analytics payload from ADK->MCP flow must exist.');

    console.log('[Test Verification] All ClickHouse MCP live runtime checks PASSED successfully!');
  });
});
