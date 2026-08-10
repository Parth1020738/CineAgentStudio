import assert from 'assert';
import dotenv from 'dotenv';
import { runStoryAgent } from '../server/agents/storyAgent.js';
import { startClickHouseMcp, stopClickHouseMcp } from '../server/mcp/clickhouseMcp.js';

dotenv.config();

describe('CineAgent Studio - Phase 1 Live Integration Tests', () => {
  it('should test Story Agent execution against Gemini API', async function() {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn('Skipping test: GOOGLE_GENAI_API_KEY not configured.');
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

  it('should test ClickHouse MCP execution connection status', async function() {
    if (!process.env.CLICKHOUSE_HOST || !process.env.CLICKHOUSE_PASSWORD) {
      console.warn('Skipping test: ClickHouse configuration missing.');
      this.skip();
      return;
    }

    try {
      const isConnected = await startClickHouseMcp();
      assert.strictEqual(isConnected, true);
    } finally {
      stopClickHouseMcp();
    }
  });
});
