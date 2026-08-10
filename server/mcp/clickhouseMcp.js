import { spawn } from 'child_process';
import path from 'path';

let mcpProcess = null;

/**
 * Starts the official ClickHouse MCP Server subprocess using localized command variables.
 * @returns {Promise<boolean>} Resolves when the process has successfully started.
 */
export function startClickHouseMcp() {
  return new Promise((resolve, reject) => {
    if (mcpProcess) {
      return resolve(true);
    }

    const host = process.env.CLICKHOUSE_HOST;
    const port = process.env.CLICKHOUSE_PORT || '9440';
    const user = process.env.CLICKHOUSE_USER || 'default';
    const password = process.env.CLICKHOUSE_PASSWORD;
    const database = process.env.CLICKHOUSE_DATABASE || 'default';

    if (!host || !password) {
      console.warn('ClickHouse credentials missing. Skipping MCP server spawn.');
      return reject(new Error('Missing ClickHouse credentials.'));
    }

    console.log('Spawning mcp-clickhouse server subprocess...');

    // Run using standard system python with module parameter
    mcpProcess = spawn('python', ['-m', 'mcp_clickhouse'], {
      env: {
        ...process.env,
        CLICKHOUSE_HOST: host,
        CLICKHOUSE_PORT: port,
        CLICKHOUSE_USER: user,
        CLICKHOUSE_PASSWORD: password,
        CLICKHOUSE_DATABASE: database,
        CLICKHOUSE_SECURE: 'true',
        CLICKHOUSE_ALLOW_WRITE_ACCESS: 'true'
      }
    });

    mcpProcess.stdout.on('data', (data) => {
      console.log(`[ClickHouse MCP stdout]: ${data}`);
    });

    mcpProcess.stderr.on('data', (data) => {
      console.warn(`[ClickHouse MCP stderr]: ${data}`);
    });

    mcpProcess.on('close', (code) => {
      console.log(`ClickHouse MCP process exited with code ${code}`);
      mcpProcess = null;
    });

    // Allow time for initialization
    setTimeout(() => {
      resolve(true);
    }, 2000);
  });
}

/**
 * Stops the running ClickHouse MCP server.
 */
export function stopClickHouseMcp() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
    console.log('ClickHouse MCP server stopped.');
  }
}
