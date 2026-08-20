import { getAgentRunAnalytics, recordAgentRun, executeMcpQuery } from './clickhouseMcp.js';

/**
 * Google ADK-compatible tool definition for querying CineAgent production analytics via ClickHouse MCP.
 * @param {object} args Parameters passed by the Google ADK Agent.
 * @param {string} [args.projectId] Optional project ID to query.
 * @returns {Promise<object>} Analytics data returned from ClickHouse via MCP run_query.
 */
export async function queryProductionAnalytics({ projectId = '' } = {}) {
  console.log(`[Google ADK → MCP Tool] Agent invoking queryProductionAnalytics for project: "${projectId}"`);
  const analyticsResult = await getAgentRunAnalytics(projectId);
  return {
    status: 'success',
    source: 'mcp-clickhouse',
    data: analyticsResult.result,
    executionTimeMs: analyticsResult.durationMs
  };
}

/**
 * Google ADK-compatible tool definition for executing arbitrary SQL queries via ClickHouse MCP run_query.
 * @param {object} args Parameters passed by the Google ADK Agent.
 * @param {string} args.query SQL query string.
 * @returns {Promise<object>} Query result returned from ClickHouse via MCP run_query.
 */
export async function executeAdkMcpQuery({ query }) {
  console.log(`[Google ADK → MCP Tool] Agent invoking executeAdkMcpQuery with SQL: "${query}"`);
  const queryResult = await executeMcpQuery(query);
  return {
    status: 'success',
    source: 'mcp-clickhouse',
    result: queryResult.result,
    executionTimeMs: queryResult.durationMs
  };
}

/**
 * Google ADK Tool definitions array for registration with ADK agents.
 */
export const clickHouseMcpAdkTools = [
  {
    name: 'queryProductionAnalytics',
    description: 'Queries production execution telemetry and agent run metrics from ClickHouse Cloud via MCP.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional film project ID to filter analytics.'
        }
      }
    },
    execute: queryProductionAnalytics
  },
  {
    name: 'executeAdkMcpQuery',
    description: 'Executes a raw SQL analytics query on ClickHouse Cloud via MCP run_query.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute on ClickHouse Cloud.'
        }
      },
      required: ['query']
    },
    execute: executeAdkMcpQuery
  }
];
