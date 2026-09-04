import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let mcpClient = null;
let mcpTransport = null;
let discoveredTools = [];
let isInitialized = false;

/**
 * Validates whether required environment configuration for ClickHouse MCP exists.
 * Supports both hosted MCP endpoint (CLICKHOUSE_MCP_URL / CLICKHOUSE_MCP_TOKEN)
 * and local stdio mcp-clickhouse server (CLICKHOUSE_HOST & CLICKHOUSE_PASSWORD).
 * @returns {boolean} True if required variables are set.
 */
export function validateClickHouseConfig() {
  const mcpToken = process.env.CLICKHOUSE_MCP_TOKEN;
  const host = process.env.CLICKHOUSE_HOST;
  const password = process.env.CLICKHOUSE_PASSWORD;
  return Boolean(mcpToken || (host && password));
}

/**
 * Initializes and connects to the official ClickHouse MCP server.
 * Automatically chooses SSEClientTransport for hosted endpoints (e.g. https://mcp.clickhouse.cloud/mcp)
 * or StdioClientTransport for local mcp-clickhouse subprocesses.
 * @returns {Promise<object>} Initialization status and list of discovered tools.
 */
export async function initMcpClient() {
  if (isInitialized && mcpClient) {
    return {
      connected: true,
      tools: discoveredTools
    };
  }

  if (!validateClickHouseConfig()) {
    throw new Error('ClickHouse configuration missing in environment. Provide CLICKHOUSE_MCP_TOKEN for hosted endpoint or CLICKHOUSE_HOST and CLICKHOUSE_PASSWORD for local stdio.');
  }

  const mcpToken = process.env.CLICKHOUSE_MCP_TOKEN;
  const mcpUrl = process.env.CLICKHOUSE_MCP_URL || 'https://mcp.clickhouse.cloud/mcp';

  if (mcpToken) {
    console.log(`[MCP Runtime] Connecting to hosted ClickHouse Cloud MCP endpoint at ${mcpUrl} via SSEClientTransport...`);
    mcpTransport = new SSEClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${mcpToken}`
        }
      }
    });
  } else {
    const host = process.env.CLICKHOUSE_HOST;
    const port = process.env.CLICKHOUSE_PORT || '8443';
    const user = process.env.CLICKHOUSE_USER || 'default';
    const password = process.env.CLICKHOUSE_PASSWORD;
    const database = process.env.CLICKHOUSE_DATABASE || 'default';

    console.log(`[MCP Runtime] Starting official mcp-clickhouse server process for host ${host}:${port} via StdioClientTransport...`);

    mcpTransport = new StdioClientTransport({
      command: 'python',
      args: ['-m', 'mcp_clickhouse.main', 'run'],
      env: {
        ...process.env,
        CLICKHOUSE_HOST: host,
        CLICKHOUSE_PORT: port,
        CLICKHOUSE_USER: user,
        CLICKHOUSE_PASSWORD: password,
        CLICKHOUSE_DATABASE: database,
        CLICKHOUSE_SECURE: process.env.CLICKHOUSE_SECURE || 'true',
        CLICKHOUSE_VERIFY: process.env.CLICKHOUSE_VERIFY || 'true',
        // Enable write access using both current and backward-compatible env vars
        CLICKHOUSE_WRITE_ACCESS: 'true',
        CLICKHOUSE_ALLOW_WRITE_ACCESS: 'true'
      }
    });
  }

  mcpClient = new Client(
    {
      name: 'cineagent-studio-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  await mcpClient.connect(mcpTransport);

  const toolsResponse = await mcpClient.listTools();
  discoveredTools = toolsResponse.tools ? toolsResponse.tools.map((t) => t.name) : [];
  isInitialized = true;

  console.log(`[MCP Runtime] Successfully connected to ClickHouse MCP server. Discovered tools: ${discoveredTools.join(', ')}`);

  return {
    connected: true,
    tools: discoveredTools
  };
}

/**
 * Returns the list of tools discovered from the connected MCP server.
 * @returns {string[]} Discovered tool names.
 */
export function listMcpTools() {
  return discoveredTools;
}

/**
 * Executes a SQL query through the MCP run_query tool.
 * @param {string} query The SQL query string.
 * @returns {Promise<any>} The query execution result returned by mcp-clickhouse.
 */
export async function executeMcpQuery(query) {
  if (!isInitialized || !mcpClient) {
    await initMcpClient();
  }

  const startTime = Date.now();
  console.log(`[MCP Tool Call] Invoking run_query tool with SQL: "${query.trim()}"`);

  const result = await mcpClient.callTool({
    name: 'run_query',
    arguments: { query }
  });

  const durationMs = Date.now() - startTime;
  console.log(`[MCP Tool Result] run_query executed in ${durationMs}ms`);

  return {
    result,
    durationMs
  };
}

let schemaInitPromise = null;
let isSchemaInitialized = false;

/**
 * Resets schema initialization state (used for testing or reconnection).
 */
export function resetSchemaInitState() {
  schemaInitPromise = null;
  isSchemaInitialized = false;
}

/**
 * Ensures the CineAgent schema tables exist in ClickHouse Cloud via MCP run_query.
 * Creates agent_runs and canonical scene_metrics tables and executes idempotent column migrations ONCE per process.
 * Concurrent callers share and await the same initialization promise.
 * @returns {Promise<boolean>} Resolves to true when schema initialization is complete.
 */
export function ensureCineAgentSchema() {
  if (isSchemaInitialized) {
    return Promise.resolve(true);
  }

  if (schemaInitPromise) {
    return schemaInitPromise;
  }

  schemaInitPromise = (async () => {
    const createAgentRunsDdl = `
      CREATE TABLE IF NOT EXISTS agent_runs (
          run_id String,
          project_id String,
          agent_name String,
          status String,
          duration_ms UInt32,
          created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree() ORDER BY (project_id, created_at)
    `;

    const createSceneMetricsDdl = `
      CREATE TABLE IF NOT EXISTS scene_metrics (
          project_id String,
          scene_id String,
          scene_number UInt16,
          scene_heading String,
          location String,
          interior_exterior String,
          time_of_day String,
          cast_count UInt16,
          extras_count UInt16,
          complexity String,
          estimated_cost Float64,
          shooting_day UInt16,
          created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree() ORDER BY (project_id, scene_number)
    `;

    await executeMcpQuery(createAgentRunsDdl);
    await executeMcpQuery(createSceneMetricsDdl);

    // Idempotent column migrations for pre-existing legacy scene_metrics tables
    const alterColumns = [
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS scene_number UInt16',
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS scene_heading String',
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS interior_exterior String',
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS time_of_day String',
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS extras_count UInt16',
      'ALTER TABLE scene_metrics ADD COLUMN IF NOT EXISTS complexity String'
    ];

    for (const alterQuery of alterColumns) {
      try {
        await executeMcpQuery(alterQuery);
      } catch (err) {
        console.warn(`[ClickHouse MCP Schema Migration] ${alterQuery}: ${err.message}`);
      }
    }

    isSchemaInitialized = true;
    return true;
  })().catch((err) => {
    schemaInitPromise = null;
    isSchemaInitialized = false;
    throw err;
  });

  return schemaInitPromise;
}

/**
 * Records an agent execution run in ClickHouse Cloud through MCP run_query.
 * @param {object} runData Metadata about the agent run.
 */
export async function recordAgentRun({ runId, projectId, agentName, status, durationMs }) {
  const escapedRunId = String(runId).replace(/'/g, "\\'");
  const escapedProjectId = String(projectId).replace(/'/g, "\\'");
  const escapedAgentName = String(agentName).replace(/'/g, "\\'");
  const escapedStatus = String(status).replace(/'/g, "\\'");
  const safeDurationMs = Number(durationMs) || 0;

  const insertQuery = `
    INSERT INTO agent_runs (run_id, project_id, agent_name, status, duration_ms, created_at)
    VALUES ('${escapedRunId}', '${escapedProjectId}', '${escapedAgentName}', '${escapedStatus}', ${safeDurationMs}, now())
  `;

  return await executeMcpQuery(insertQuery);
}

/**
 * Queries agent run analytics from ClickHouse Cloud through MCP run_query.
 * @param {string} [projectId] Optional filter for project ID.
 */
export async function getAgentRunAnalytics(projectId = '') {
  let whereClause = '';
  if (projectId) {
    const escapedProjectId = String(projectId).replace(/'/g, "\\'");
    whereClause = `WHERE project_id = '${escapedProjectId}'`;
  }

  const selectQuery = `
    SELECT run_id, project_id, agent_name, status, duration_ms, created_at
    FROM agent_runs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return await executeMcpQuery(selectQuery);
}

/**
 * Gracefully stops the MCP client and subprocess/connection.
 */
export async function stopMcpClient() {
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch (err) {
      // Ignore cleanup error
    }
    mcpClient = null;
  }
  if (mcpTransport) {
    try {
      await mcpTransport.close();
    } catch (err) {
      // Ignore cleanup error
    }
    mcpTransport = null;
  }
  isInitialized = false;
  discoveredTools = [];
  console.log('[MCP Runtime] ClickHouse MCP client stopped.');
}
