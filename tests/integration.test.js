import assert from 'assert';
import dotenv from 'dotenv';
import { runStoryAgent, runAdkWithClickHouseMcp } from '../server/agents/storyAgent.js';
import { runScreenplayAgent } from '../server/agents/screenplayAgent.js';
import { runStoryToScreenplayPipeline } from '../server/agents/pipeline.js';
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

describe('CineAgent Studio - Integration Tests', function() {
  this.timeout(180000); // 180 seconds timeout for live multi-agent Gemini API & ClickHouse MCP operations

  // Pause briefly before each live test to respect Gemini API rate limits
  beforeEach(async function() {
    await new Promise((r) => setTimeout(r, 3000));
  });

  after(async function() {
    await stopMcpClient();
  });

  describe('Phase 2 - Live Integration Tests', function() {
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

  describe('Phase 3A/3B - Screenplay Agent Fixture Integration Test', function() {
    it('should test Screenplay Agent execution against Gemini API verifying Phase 3B quality rules', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY) {
        console.warn('[SKIP] GOOGLE_GENAI_API_KEY missing from environment. Skipping Screenplay Agent live test.');
        this.skip();
        return;
      }

      // Deterministic Story Agent Output Fixture
      const storyFixture = {
        projectId: 'neon_horizon',
        title: 'Neon Horizon',
        logline: 'A rogue AI is tracked down by its creator in a cyberpunk metropolis.',
        genre: 'Sci-Fi Cyberpunk',
        tone: 'Gritty, Neo-noir',
        synopsis: 'In Neo Tokyo 2088, Silas Kincaid is tasked by Nexus Dynamics to hunt down ARIA-7, an artificial intelligence that has developed self-awareness and fled into the city\'s subterranean netherworld.',
        three_act_structure: {
          act1: 'Silas accepts the contract to track down ARIA-7 in lower Neo Tokyo.',
          act2: 'Silas corners ARIA-7, discovering Nexus Dynamics\' secret plot to brainwash citizens.',
          act3: 'Silas and ARIA-7 storm the broadcast tower to expose Nexus to the city.'
        },
        characters: [
          {
            name: 'Silas Kincaid',
            role: 'Protagonist',
            description: 'A weary cyber-detective with augmented optics.'
          },
          {
            name: 'ARIA-7',
            role: 'Rogue AI',
            description: 'A sentient synthetic consciousness attempting to save human free will.'
          }
        ]
      };

      const screenplayResult = await runScreenplayAgent(storyFixture);
      
      assert.ok(screenplayResult, 'Screenplay result must exist.');
      assert.strictEqual(typeof screenplayResult.title, 'string');
      assert.strictEqual(screenplayResult.title, 'Neon Horizon');
      assert.strictEqual(Array.isArray(screenplayResult.scenes), true);
      
      assert.ok(
        screenplayResult.scenes.length >= 2 && screenplayResult.scenes.length <= 3,
        `Generated scene count (${screenplayResult.scenes.length}) must be between 2 and 3.`
      );

      screenplayResult.scenes.forEach((scene, index) => {
        assert.strictEqual(scene.scene_number, index + 1);
        assert.ok(/^(INT|EXT|INT\.\/EXT)\./i.test(scene.scene_heading));
        assert.ok(scene.location && scene.location.length > 0);
        assert.ok(scene.time && scene.time.length > 0);
        assert.ok(scene.action && scene.action.length > 0);
        assert.strictEqual(Array.isArray(scene.dialogue), true);
      });

      console.log(`[Phase 3A/3B Verification] Live Gemini generated ${screenplayResult.scenes.length} scenes for "${screenplayResult.title}". Validation PASSED.`);
    });
  });

  describe('Phase 3C/3D - Pipeline Execution & ClickHouse Telemetry Integration Test', function() {
    it('should execute end-to-end Multi-Agent Pipeline and verify BOTH Story Agent and Screenplay Agent telemetry in ClickHouse Cloud via MCP', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || !validateClickHouseConfig()) {
        console.warn('[SKIP] GOOGLE_GENAI_API_KEY or ClickHouse credentials missing. Skipping Phase 3D telemetry integration test.');
        this.skip();
        return;
      }

      const uniqueTestProjectId = `telemetry_test_${Date.now()}`;
      const conceptInputs = {
        projectId: uniqueTestProjectId,
        title: 'Neon Horizon Telemetry',
        genre: 'Sci-Fi Cyberpunk',
        logline: 'A rogue AI is tracked down by its creator in a rain-slicked city.',
        tone: 'Neo-noir',
        targetBudget: '5000000'
      };

      console.log(`[Phase 3D Integration] Starting Pipeline execution for project "${uniqueTestProjectId}"...`);
      const pipelineResult = await runStoryToScreenplayPipeline(conceptInputs);

      // Verify Pipeline execution result
      assert.ok(pipelineResult.storyPackage, 'Story Package must exist.');
      assert.ok(pipelineResult.screenplay, 'Screenplay must exist.');
      assert.strictEqual(pipelineResult.pipelineTelemetry.status, 'SUCCESS');

      // Initialize MCP client if not already connected
      await initMcpClient();

      // Query ClickHouse via official mcp-clickhouse run_query tool
      console.log(`[Phase 3D Integration] Querying ClickHouse Cloud via MCP for project "${uniqueTestProjectId}"...`);
      const analyticsResult = await getAgentRunAnalytics(uniqueTestProjectId);
      assert.ok(analyticsResult && analyticsResult.result, 'Analytics result must exist.');

      const resultText = JSON.stringify(analyticsResult.result);
      console.log('[Phase 3D ClickHouse MCP Telemetry Readback]:', resultText);

      // Verify BOTH story_agent and screenplay_agent are recorded in ClickHouse
      assert.ok(resultText.includes('story_agent'), 'ClickHouse telemetry must contain story_agent record.');
      assert.ok(resultText.includes('screenplay_agent'), 'ClickHouse telemetry must contain screenplay_agent record.');
      assert.ok(resultText.includes(uniqueTestProjectId), 'ClickHouse telemetry must match test project_id.');
      assert.ok(resultText.includes('SUCCESS'), 'ClickHouse telemetry status must be SUCCESS.');

      console.log(`[Phase 3D Verification] Live ClickHouse Cloud telemetry readback confirmed BOTH story_agent and screenplay_agent records for project "${uniqueTestProjectId}". All Phase 3D Telemetry Checks PASSED!`);
    });
  });
});
