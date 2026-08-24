import { executeMcpQuery, validateClickHouseConfig } from '../mcp/clickhouseMcp.js';

/**
 * Ensures all production analytics tables exist in ClickHouse Cloud via MCP run_query.
 */
export async function ensureProductionAnalyticsSchema() {
  if (!validateClickHouseConfig()) {
    console.warn('[Analytics Service] ClickHouse credentials missing. Skipping schema creation.');
    return;
  }

  const ddlQueries = [
    `CREATE TABLE IF NOT EXISTS agent_runs (
        run_id String,
        project_id String,
        agent_name String,
        status String,
        duration_ms UInt32,
        created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (project_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS scene_metrics (
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
    ) ENGINE = MergeTree() ORDER BY (project_id, scene_number)`,

    `CREATE TABLE IF NOT EXISTS project_budgets (
        project_id String,
        title String,
        target_budget Float64,
        estimated_total Float64,
        budget_status String,
        budget_variance Float64,
        scene_linked_cost_total Float64,
        project_wide_cost_total Float64,
        contingency_cost Float64,
        created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (project_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS budget_categories (
        project_id String,
        category String,
        estimated_cost Float64,
        explanation String,
        created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (project_id, category)`,

    `CREATE TABLE IF NOT EXISTS budget_drivers (
        project_id String,
        factor String,
        impact Float64,
        explanation String,
        created_at DateTime DEFAULT now()
    ) ENGINE = MergeTree() ORDER BY (project_id, factor)`
  ];

  for (const query of ddlQueries) {
    await executeMcpQuery(query);
  }
}

/**
 * Escapes a single string for SQL insertion.
 * @param {string} val String value to escape
 * @returns {string} Escaped string
 */
function escapeSqlString(val) {
  if (val == null) return '';
  return String(val).replace(/'/g, "\\'");
}

/**
 * Persists breakdown, budget, and schedule metrics to ClickHouse Cloud via MCP.
 * @param {object} params Analytics input container
 */
export async function recordProductionAnalytics({ projectId, title, breakdown, budget, schedule }) {
  if (!validateClickHouseConfig()) {
    console.warn('[Analytics Service] ClickHouse credentials missing. Skipping production analytics persistence.');
    return;
  }

  await ensureProductionAnalyticsSchema();

  const safeProjectId = escapeSqlString(projectId || breakdown?.project_id || budget?.project_id || schedule?.project_id);
  const safeTitle = escapeSqlString(title || breakdown?.title || budget?.title || schedule?.title);

  // Build shooting day map if schedule is present
  const sceneShootingDayMap = new Map();
  if (schedule && Array.isArray(schedule.days)) {
    schedule.days.forEach((day) => {
      if (Array.isArray(day.scenes)) {
        day.scenes.forEach((scNum) => {
          sceneShootingDayMap.set(Number(scNum), Number(day.shooting_day) || 1);
        });
      }
    });
  }

  // 1. Record Scene Metrics
  if (breakdown && Array.isArray(breakdown.scenes)) {
    for (const scene of breakdown.scenes) {
      const sceneNum = Number(scene.scene_number) || 1;
      const sceneId = escapeSqlString(`scene_${sceneNum}`);
      const heading = escapeSqlString(scene.scene_heading);
      const location = escapeSqlString(scene.location);
      const ie = escapeSqlString(scene.interior_exterior);
      const tod = escapeSqlString(scene.time_of_day);
      const castCount = Array.isArray(scene.characters) ? scene.characters.length : 0;
      const extrasCount = Number(scene.extras_count) || 0;
      const complexity = escapeSqlString(scene.production_complexity);
      const cost = Number(scene.estimated_cost) || 0;
      const shootingDay = sceneShootingDayMap.get(sceneNum) || 0;

      const insertSceneQuery = `
        INSERT INTO scene_metrics (
          project_id, scene_id, scene_number, scene_heading, location,
          interior_exterior, time_of_day, cast_count, extras_count, complexity, estimated_cost, shooting_day, created_at
        ) VALUES (
          '${safeProjectId}', '${sceneId}', ${sceneNum}, '${heading}', '${location}',
          '${ie}', '${tod}', ${castCount}, ${extrasCount}, '${complexity}', ${cost}, ${shootingDay}, now()
        )
      `;
      await executeMcpQuery(insertSceneQuery);
    }
  }

  // 2. Record Project Budget Summary
  if (budget) {
    const targetBudget = Number(budget.target_budget) || 0;
    const estimatedTotal = Number(budget.estimated_total) || 0;
    const status = escapeSqlString(budget.budget_status);
    const variance = Number(budget.budget_variance) || 0;
    const recon = budget.budget_reconciliation || {};
    const sceneLinked = Number(recon.scene_linked_cost_total) || 0;
    const projectWide = Number(recon.project_wide_cost_total) || 0;
    const contingency = Number(recon.contingency_cost) || 0;

    const insertBudgetQuery = `
      INSERT INTO project_budgets (
        project_id, title, target_budget, estimated_total, budget_status, budget_variance,
        scene_linked_cost_total, project_wide_cost_total, contingency_cost, created_at
      ) VALUES (
        '${safeProjectId}', '${safeTitle}', ${targetBudget}, ${estimatedTotal}, '${status}', ${variance},
        ${sceneLinked}, ${projectWide}, ${contingency}, now()
      )
    `;
    await executeMcpQuery(insertBudgetQuery);

    // 3. Record Budget Categories
    if (Array.isArray(budget.categories)) {
      for (const cat of budget.categories) {
        const categoryName = escapeSqlString(cat.category);
        const catCost = Number(cat.estimated_cost) || 0;
        const explanation = escapeSqlString(cat.explanation);

        const insertCategoryQuery = `
          INSERT INTO budget_categories (project_id, category, estimated_cost, explanation, created_at)
          VALUES ('${safeProjectId}', '${categoryName}', ${catCost}, '${explanation}', now())
        `;
        await executeMcpQuery(insertCategoryQuery);
      }
    }

    // 4. Record Major Cost Drivers
    if (Array.isArray(budget.major_cost_drivers)) {
      for (const driver of budget.major_cost_drivers) {
        const factor = escapeSqlString(driver.factor);
        const impact = Number(driver.impact) || 0;
        const explanation = escapeSqlString(driver.explanation);

        const insertDriverQuery = `
          INSERT INTO budget_drivers (project_id, factor, impact, explanation, created_at)
          VALUES ('${safeProjectId}', '${factor}', ${impact}, '${explanation}', now())
        `;
        await executeMcpQuery(insertDriverQuery);
      }
    }
  }

  console.log(`[Analytics Service] Successfully persisted production analytics for project "${safeProjectId}" to ClickHouse Cloud via MCP.`);
}

/**
 * Parses raw tool output from mcp-clickhouse into standard rows array.
 * @param {object} mcpResult Result wrapper from executeMcpQuery
 * @returns {Array<object>} Array of row objects/arrays
 */
export function parseMcpRows(mcpResult) {
  if (!mcpResult || !mcpResult.result) return [];
  
  const content = mcpResult.result.content || [];
  for (const item of content) {
    if (item.type === 'text' && item.text) {
      try {
        const parsed = JSON.parse(item.text);
        if (parsed.rows && Array.isArray(parsed.rows)) {
          if (parsed.columns && Array.isArray(parsed.columns)) {
            return parsed.rows.map((row) => {
              if (Array.isArray(row)) {
                const obj = {};
                parsed.columns.forEach((col, idx) => {
                  obj[col] = row[idx];
                });
                return obj;
              }
              return row;
            });
          }
          return parsed.rows;
        }
      } catch (err) {
        // Not valid JSON text, continue
      }
    }
  }
  return [];
}

/**
 * Returns overall project production budget summary.
 * @param {string} projectId Scoped project ID
 */
export async function getProjectProductionSummary(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT 
      pb.target_budget AS target_budget,
      pb.estimated_total AS estimated_total,
      pb.budget_status AS budget_status,
      pb.budget_variance AS budget_variance,
      COUNT(sm.scene_id) AS scene_count,
      COUNT(DISTINCT sm.location) AS location_count,
      SUM(sm.estimated_cost) AS total_scene_costs
    FROM project_budgets pb
    LEFT JOIN scene_metrics sm ON pb.project_id = sm.project_id
    WHERE pb.project_id = '${safeProjectId}'
    GROUP BY pb.target_budget, pb.estimated_total, pb.budget_status, pb.budget_variance
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res)[0] || null;
}

/**
 * Returns top scenes ordered by estimated cost descending.
 * @param {string} projectId Scoped project ID
 * @param {number} [limit=5] Max scenes to return
 */
export async function getHighestCostScenes(projectId, limit = 5) {
  const safeProjectId = escapeSqlString(projectId);
  const safeLimit = Math.max(1, Number(limit) || 5);
  const query = `
    SELECT scene_number, scene_heading, location, complexity, estimated_cost
    FROM scene_metrics
    WHERE project_id = '${safeProjectId}'
    ORDER BY estimated_cost DESC
    LIMIT ${safeLimit}
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}

/**
 * Returns estimated scene cost aggregated by location.
 * @param {string} projectId Scoped project ID
 */
export async function getCostByLocation(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT location, COUNT(scene_id) AS scene_count, SUM(estimated_cost) AS total_cost
    FROM scene_metrics
    WHERE project_id = '${safeProjectId}'
    GROUP BY location
    ORDER BY total_cost DESC
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}

/**
 * Returns budget category cost breakdown.
 * @param {string} projectId Scoped project ID
 */
export async function getCostByCategory(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT category, estimated_cost, explanation
    FROM budget_categories
    WHERE project_id = '${safeProjectId}'
    ORDER BY estimated_cost DESC
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}

/**
 * Returns scene count breakdown by complexity (LOW, MEDIUM, HIGH).
 * @param {string} projectId Scoped project ID
 */
export async function getComplexityDistribution(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT complexity, COUNT(scene_id) AS scene_count
    FROM scene_metrics
    WHERE project_id = '${safeProjectId}'
    GROUP BY complexity
    ORDER BY scene_count DESC
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}

/**
 * Returns cast and extras load per scene.
 * @param {string} projectId Scoped project ID
 */
export async function getCastLoadByScene(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT scene_number, scene_heading, location, cast_count, extras_count
    FROM scene_metrics
    WHERE project_id = '${safeProjectId}'
    ORDER BY scene_number ASC
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}

/**
 * Returns major cost drivers for a project.
 * @param {string} projectId Scoped project ID
 */
export async function getMajorCostDrivers(projectId) {
  const safeProjectId = escapeSqlString(projectId);
  const query = `
    SELECT factor, impact, explanation
    FROM budget_drivers
    WHERE project_id = '${safeProjectId}'
    ORDER BY impact DESC
  `;
  const res = await executeMcpQuery(query);
  return parseMcpRows(res);
}
