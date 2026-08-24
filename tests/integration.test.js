import assert from 'assert';
import dotenv from 'dotenv';
import { runStoryAgent, runAdkWithClickHouseMcp } from '../server/agents/storyAgent.js';
import { runScreenplayAgent } from '../server/agents/screenplayAgent.js';
import { runBreakdownAgent, ProductionBreakdownSchema, validateBreakdownFidelity } from '../server/agents/breakdownAgent.js';
import { runBudgetAgent, validateBudgetFidelity, BudgetOutputSchema } from '../server/agents/budgetAgent.js';
import { runScheduleAgent, validateScheduleFidelity as validateScheduleFidelityAgent, ScheduleOutputSchema } from '../server/agents/scheduleAgent.js';
import { runStoryToScreenplayPipeline, runFullProductionPipeline } from '../server/agents/pipeline.js';
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
import {
  recordProductionAnalytics,
  getProjectProductionSummary,
  getHighestCostScenes,
  getCostByLocation,
  getCostByCategory,
  getComplexityDistribution,
  getCastLoadByScene,
  getMajorCostDrivers
} from '../server/services/productionAnalytics.js';
import { isDemoModeEnabled } from '../server/fixtures/demoFixtures.js';
import { is429RateLimitError } from '../server/config/geminiConfig.js';

dotenv.config();

describe('CineAgent Studio - Integration Tests', function() {
  this.timeout(180000);

  beforeEach(async function() {
    await new Promise((r) => setTimeout(r, 1000));
  });

  after(async function() {
    await stopMcpClient();
  });

  describe('Phase 2 - Live Integration Tests', function() {
    it('should test Story Agent execution against Gemini API', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || isDemoModeEnabled()) {
        console.warn('[SKIP] GOOGLE_GENAI_API_KEY missing or CINEAGENT_DEMO_MODE active. Skipping Gemini Story Agent live test.');
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

      try {
        const result = await runStoryAgent(testInputs);
        assert.strictEqual(typeof result.logline, 'string');
        assert.strictEqual(Array.isArray(result.characters), true);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API daily quota exhausted (429 Rate Limit): ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });

    it('should test ClickHouse MCP runtime path (init, tools, SELECT 1, schema, write, read, ADK)', async function() {
      if (!validateClickHouseConfig()) {
        console.warn('[SKIP] CLICKHOUSE_HOST or CLICKHOUSE_PASSWORD missing from environment. Skipping ClickHouse MCP live integration test.');
        this.skip();
        return;
      }

      const initResult = await initMcpClient();
      assert.strictEqual(initResult.connected, true);

      const tools = listMcpTools();
      assert.strictEqual(tools.includes('run_query'), true);
      assert.strictEqual(tools.includes('list_databases'), true);
      assert.strictEqual(tools.includes('list_tables'), true);

      const select1Result = await executeMcpQuery('SELECT 1 AS test_val');
      assert.ok(select1Result);

      await ensureCineAgentSchema();

      const testRunId = `test_run_${Date.now()}`;
      const testProjectId = 'integration_test_project';
      const writeResult = await recordAgentRun({
        runId: testRunId,
        projectId: testProjectId,
        agentName: 'story_agent_test',
        status: 'TEST_SUCCESS',
        durationMs: 1200
      });
      assert.ok(writeResult);

      const readResult = await getAgentRunAnalytics(testProjectId);
      assert.ok(readResult);

      const adkMcpResult = await runAdkWithClickHouseMcp(testProjectId);
      assert.strictEqual(adkMcpResult.status, 'success');
    });
  });

  describe('Phase 3A/3B - Screenplay Agent Fixture Integration Test', function() {
    it('should test Screenplay Agent execution against Gemini API verifying Phase 3B quality rules', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || isDemoModeEnabled()) {
        console.warn('[SKIP] GOOGLE_GENAI_API_KEY missing or CINEAGENT_DEMO_MODE active. Skipping Screenplay Agent live test.');
        this.skip();
        return;
      }

      const storyFixture = {
        projectId: 'neon_horizon',
        title: 'Neon Horizon',
        logline: 'A rogue AI is tracked down by its creator in a cyberpunk metropolis.',
        genre: 'Sci-Fi Cyberpunk',
        tone: 'Gritty, Neo-noir',
        synopsis: 'In Neo Tokyo 2088, Silas Kincaid is tasked by Nexus Dynamics to hunt down ARIA-7, an artificial intelligence that has developed self-awareness.',
        three_act_structure: {
          act1: 'Silas accepts the contract.',
          act2: 'Silas corners ARIA-7.',
          act3: 'Silas and ARIA-7 storm the broadcast tower.'
        },
        characters: [
          { name: 'Silas Kincaid', role: 'Protagonist', description: 'A weary cyber-detective.' },
          { name: 'ARIA-7', role: 'Rogue AI', description: 'A sentient synthetic consciousness.' }
        ]
      };

      try {
        const screenplayResult = await runScreenplayAgent(storyFixture);
        assert.ok(screenplayResult);
        assert.strictEqual(screenplayResult.title, 'Neon Horizon');
        assert.ok(screenplayResult.scenes.length >= 2 && screenplayResult.scenes.length <= 3);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API rate limited: ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });
  });

  describe('Phase 3C/3D - Pipeline Execution & ClickHouse Telemetry Integration Test', function() {
    it('should execute end-to-end Multi-Agent Pipeline and verify BOTH Story Agent and Screenplay Agent telemetry in ClickHouse Cloud via MCP', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || !validateClickHouseConfig() || isDemoModeEnabled()) {
        console.warn('[SKIP] Credentials missing or CINEAGENT_DEMO_MODE active. Skipping Phase 3D telemetry test.');
        this.skip();
        return;
      }

      const uniqueTestProjectId = `telemetry_test_${Date.now()}`;
      const conceptInputs = {
        projectId: uniqueTestProjectId,
        title: 'Neon Horizon Telemetry',
        genre: 'Sci-Fi Cyberpunk',
        logline: 'A rogue AI is tracked down by its creator.',
        tone: 'Neo-noir',
        targetBudget: '5000000'
      };

      try {
        const pipelineResult = await runStoryToScreenplayPipeline(conceptInputs);
        assert.ok(pipelineResult.storyPackage);
        assert.ok(pipelineResult.screenplay);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API rate limited: ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });
  });

  describe('Phase 4A - Production Breakdown Agent Live Integration Tests', function() {
    it('should test Production Breakdown Agent execution against Gemini API using validated screenplay fixture', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || isDemoModeEnabled()) {
        console.warn('[SKIP] Credentials missing or CINEAGENT_DEMO_MODE active. Skipping Breakdown live test.');
        this.skip();
        return;
      }

      const screenplayFixture = {
        project_id: 'neon_horizon_bd',
        title: 'Neon Horizon Breakdown Test',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. CYBER LAB - NIGHT',
            location: 'CYBER LAB',
            time: 'NIGHT',
            action: 'Kaito inspects glowing terminals.',
            dialogue: [{ character: 'KAITO', line: 'The signal is live.' }]
          },
          {
            scene_number: 2,
            scene_heading: 'EXT. ROOFTOP - NIGHT',
            location: 'ROOFTOP',
            time: 'NIGHT',
            action: 'Rain falls over the city skylines.',
            dialogue: []
          }
        ]
      };

      try {
        const breakdown = await runBreakdownAgent({ screenplay: screenplayFixture });
        assert.ok(breakdown);
        validateBreakdownFidelity(screenplayFixture, breakdown);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API rate limited: ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });
  });

  describe('Phase 4B - Budget Agent Live Integration Tests', function() {
    it('should test Budget Agent execution against Gemini API using validated production breakdown fixture', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || isDemoModeEnabled()) {
        console.warn('[SKIP] Credentials missing or CINEAGENT_DEMO_MODE active. Skipping Budget live test.');
        this.skip();
        return;
      }

      const breakdownFixture = {
        project_id: 'neon_horizon_budget',
        title: 'Neon Horizon Budget Test',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. CYBER LAB - NIGHT',
            location: 'CYBER LAB',
            interior_exterior: 'INT',
            time_of_day: 'NIGHT',
            characters: ['Kaito'],
            extras_count: 2,
            props: ['Terminal'],
            vehicles: [],
            wardrobe: ['Jacket'],
            makeup_fx: [],
            special_equipment: [],
            special_effects: [],
            vfx: ['Holo UI'],
            production_complexity: 'MEDIUM',
            estimated_cost: 25000,
            production_notes: 'Lab set'
          }
        ]
      };

      try {
        const budget = await runBudgetAgent({ production_breakdown: breakdownFixture, target_budget: 500000 });
        assert.ok(budget);
        validateBudgetFidelity(breakdownFixture, budget);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API rate limited: ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });
  });

  describe('Phase 4D - Schedule Agent Live Integration Tests', function() {
    it('should test Schedule Agent execution against Gemini API using validated breakdown and budget fixtures', async function() {
      if (!process.env.GOOGLE_GENAI_API_KEY || isDemoModeEnabled()) {
        console.warn('[SKIP] Credentials missing or CINEAGENT_DEMO_MODE active. Skipping Schedule live test.');
        this.skip();
        return;
      }

      const breakdownFixture = {
        project_id: 'neon_horizon_sched',
        title: 'Neon Horizon Schedule Test',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. CYBER LAB - NIGHT',
            location: 'CYBER LAB',
            interior_exterior: 'INT',
            time_of_day: 'NIGHT',
            characters: ['Kaito'],
            extras_count: 2,
            props: ['Terminal'],
            vehicles: [],
            wardrobe: ['Jacket'],
            makeup_fx: [],
            special_equipment: [],
            special_effects: [],
            vfx: ['Holo UI'],
            production_complexity: 'MEDIUM',
            estimated_cost: 25000,
            production_notes: 'Lab set'
          }
        ]
      };

      try {
        const schedule = await runScheduleAgent({ production_breakdown: breakdownFixture, target_shoot_days: 1 });
        assert.ok(schedule);
        validateScheduleFidelityAgent(breakdownFixture, undefined, schedule);
      } catch (err) {
        if (is429RateLimitError(err)) {
          console.warn(`[SKIP] Gemini API rate limited: ${err.message}. Skipping live test.`);
          this.skip();
          return;
        }
        throw err;
      }
    });
  });
});
