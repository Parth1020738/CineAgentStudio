import React from 'react';

export default function ProductionInsightsView({ insights, projectId }) {
  const formatCurrency = (val) => {
    if (typeof val !== 'number') return '$0';
    return '$' + val.toLocaleString();
  };

  if (!insights || (insights.clickHouseConnected === false && !insights.isDemoData)) {
    return (
      <div className="card empty-state-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Production plan ready</h3>
        <p style={{ color: '#9ca3af' }}>Live analytics unavailable</p>
      </div>
    );
  }

  const summary = insights.summary || {};
  const highestCostScenes = insights.highestCostScenes || [];
  const costByLocation = insights.costByLocation || [];
  const costByCategory = insights.costByCategory || [];
  const complexityDist = insights.complexityDistribution || [];
  const castLoad = insights.castLoadByScene || [];
  const majorDrivers = insights.majorCostDrivers || [];

  return (
    <div className="insights-workspace">
      {/* 1. Header Card */}
      <section className="card insights-header-card" aria-label="Production Insights Header">
        <div className="insights-header-top">
          <div>
            <h2 className="insights-title">PRODUCTION INSIGHTS</h2>
            <p className="section-subtitle">
              Production intelligence powered by ClickHouse Cloud via MCP.
            </p>
          </div>
          <div className="insights-status-strip">
            {insights.isDemoData ? (
              <>
                <span className="demo-dot"></span>
                <span className="live-text">Production Analytics</span>
                <span className="sync-badge demo-badge">LOCAL DEMO DATA</span>
              </>
            ) : (
              <>
                <span className="live-dot"></span>
                <span className="live-text">ClickHouse Cloud Production Analytics</span>
                <span className="sync-badge">Live Synced via MCP</span>
              </>
            )}
            <span className="project-tag">Project ID: {projectId}</span>
          </div>
        </div>
      </section>

      {/* 2. Project Summary KPIs Section */}
      <section className="insights-section" aria-label="Project Summary">
        <h3 className="insights-section-title">PROJECT SUMMARY</h3>
        <div className="insights-kpi-grid">
          <div className="insights-kpi-card">
            <span className="ikpi-label">ESTIMATED COST</span>
            <span className="ikpi-val highlight-gold">{formatCurrency(summary.estimated_total)}</span>
            <span className="ikpi-sub">Total Line-Item Forecast</span>
          </div>

          <div className="insights-kpi-card">
            <span className="ikpi-label">TARGET BUDGET</span>
            <span className="ikpi-val">{formatCurrency(summary.target_budget)}</span>
            <span className="ikpi-sub">Producer Budget Cap</span>
          </div>

          <div className="insights-kpi-card">
            <span className="ikpi-label">BUDGET VARIANCE</span>
            <span className={`ikpi-val ${summary.target_variance < 0 ? 'text-green' : summary.target_variance > 0 ? 'text-red' : ''}`}>
              {summary.target_variance > 0 ? '+' : ''}{formatCurrency(summary.target_variance)}
            </span>
            <span className="ikpi-sub">Status: {summary.budget_status || 'OK'}</span>
          </div>

          <div className="insights-kpi-card">
            <span className="ikpi-label">TOTAL SCENES</span>
            <span className="ikpi-val">{summary.total_scenes || 0} Scenes</span>
            <span className="ikpi-sub">Breakdown Total</span>
          </div>

          <div className="insights-kpi-card">
            <span className="ikpi-label">SHOOT DAYS</span>
            <span className="ikpi-val text-blue">{summary.total_shoot_days || 0} Days</span>
            <span className="ikpi-sub">Shooting Schedule Length</span>
          </div>
        </div>
      </section>

      {/* 3. Cost Analysis Section */}
      <section className="insights-section" aria-label="Cost Analysis">
        <h3 className="insights-section-title">COST ANALYSIS</h3>
        <div className="insights-grid-2col">
          {/* Card A: Highest-Cost Scenes */}
          <div className="card insights-panel" aria-label="Highest-Cost Scenes">
            <div className="panel-header">
              <h4>🎬 Highest-Cost Scenes</h4>
              <p className="panel-subtitle">Scenes generating highest asset and production expenditure.</p>
            </div>
            <div className="panel-body">
              {highestCostScenes.length === 0 ? (
                <p className="muted-text">No scene cost breakdown data available.</p>
              ) : (
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Scene #</th>
                      <th>Heading</th>
                      <th>Location</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highestCostScenes.map((sc, idx) => (
                      <tr key={idx}>
                        <td><strong>Scene {sc.scene_id || sc.scene_number}</strong></td>
                        <td>{sc.scene_heading}</td>
                        <td>{sc.location}</td>
                        <td className="text-gold"><strong>{formatCurrency(sc.estimated_cost)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Card B: Cost by Location */}
          <div className="card insights-panel" aria-label="Cost by Location">
            <div className="panel-header">
              <h4>📍 Cost by Location</h4>
              <p className="panel-subtitle">Aggregated production expenditure grouped by location.</p>
            </div>
            <div className="panel-body">
              {costByLocation.length === 0 ? (
                <p className="muted-text">No location cost data available.</p>
              ) : (
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Scenes</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costByLocation.map((loc, idx) => (
                      <tr key={idx}>
                        <td><strong>{loc.location}</strong></td>
                        <td>{loc.scene_count}</td>
                        <td className="text-gold"><strong>{formatCurrency(loc.total_cost)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Production Complexity Section */}
      <section className="insights-section" aria-label="Production Complexity">
        <h3 className="insights-section-title">PRODUCTION COMPLEXITY</h3>
        <div className="insights-grid-2col">
          {/* Card A: Complexity Distribution */}
          <div className="card insights-panel" aria-label="Complexity Distribution">
            <div className="panel-header">
              <h4>⚡ Complexity Distribution</h4>
              <p className="panel-subtitle">Technical scene complexity classification (HIGH / MEDIUM / LOW).</p>
            </div>
            <div className="panel-body">
              {complexityDist.length === 0 ? (
                <p className="muted-text">No complexity distribution data available.</p>
              ) : (
                <div className="complexity-badge-list">
                  {complexityDist.map((comp, idx) => (
                    <div key={idx} className={`complexity-card complexity-${String(comp.production_complexity).toLowerCase()}`}>
                      <div className="comp-top">
                        <span className="comp-tag">{comp.production_complexity}</span>
                        <span className="comp-count">{comp.scene_count} Scene(s)</span>
                      </div>
                      <span className="comp-cost">{formatCurrency(comp.total_cost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card B: Cast & Extras Load */}
          <div className="card insights-panel" aria-label="Cast & Extras Load">
            <div className="panel-header">
              <h4>👥 Cast & Extras Load</h4>
              <p className="panel-subtitle">Scene-level talent allocation and actor roster load.</p>
            </div>
            <div className="panel-body">
              {castLoad.length === 0 ? (
                <p className="muted-text">No cast load data available.</p>
              ) : (
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th>Scene #</th>
                      <th>Location</th>
                      <th>Cast Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {castLoad.map((cl, idx) => (
                      <tr key={idx}>
                        <td><strong>Scene {cl.scene_id || cl.scene_number}</strong></td>
                        <td>{cl.location}</td>
                        <td><span className="badge-pill">{cl.cast_count} Actor(s)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Major Cost Drivers Section */}
      <section className="insights-section" aria-label="Major Cost Drivers">
        <div className="card insights-panel full-width-card" aria-label="Major Cost Drivers Card">
          <div className="panel-header">
            <h4>⚠️ MAJOR COST DRIVERS</h4>
            <p className="panel-subtitle">Primary production cost drivers identified by ClickHouse Cloud analytics.</p>
          </div>
          <div className="panel-body">
            {majorDrivers.length === 0 ? (
              <p className="muted-text">No major cost driver records found.</p>
            ) : (
              <table className="insights-table cost-drivers-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Factor</th>
                    <th style={{ width: '20%' }}>Impact</th>
                    <th style={{ width: '55%' }}>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {majorDrivers.map((driver, idx) => (
                    <tr key={idx}>
                      <td><strong>{driver.factor}</strong></td>
                      <td className="text-red"><strong>+{formatCurrency(driver.impact)}</strong></td>
                      <td>{driver.explanation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
