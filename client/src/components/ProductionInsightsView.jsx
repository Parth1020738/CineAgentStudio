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
      {/* ClickHouse Cloud MCP Status Banner */}
      <div className="insights-status-strip">
        <div className="status-left">
          {insights.isDemoData ? (
            <>
              <span className="demo-dot" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', marginRight: 6 }}></span>
              <span className="live-text">Production Analytics</span>
              <span className="sync-badge demo-badge" style={{ backgroundColor: '#78350f', color: '#fef3c7', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>LOCAL DEMO DATA</span>
            </>
          ) : (
            <>
              <span className="live-dot"></span>
              <span className="live-text">ClickHouse Cloud Production Analytics</span>
              <span className="sync-badge">Live Synced via MCP</span>
            </>
          )}
        </div>
        <div className="status-right">
          <span className="project-tag">Project ID: {projectId}</span>
        </div>
      </div>

      {/* High-Level Production KPI Summary */}
      <div className="insights-kpi-grid">
        <div className="insights-kpi-card">
          <span className="ikpi-label">Target Budget</span>
          <span className="ikpi-val">{formatCurrency(summary.target_budget)}</span>
          <span className="ikpi-sub">Producer Cap</span>
        </div>

        <div className="insights-kpi-card">
          <span className="ikpi-label">Estimated Total</span>
          <span className="ikpi-val highlight-gold">{formatCurrency(summary.estimated_total)}</span>
          <span className="ikpi-sub">Line-Item Total</span>
        </div>

        <div className="insights-kpi-card">
          <span className="ikpi-label">Budget Variance</span>
          <span className={`ikpi-val ${summary.target_variance < 0 ? 'text-green' : summary.target_variance > 0 ? 'text-red' : ''}`}>
            {summary.target_variance > 0 ? '+' : ''}{formatCurrency(summary.target_variance)}
          </span>
          <span className="ikpi-sub">Status: {summary.budget_status || 'OK'}</span>
        </div>

        <div className="insights-kpi-card">
          <span className="ikpi-label">Total Scenes</span>
          <span className="ikpi-val">{summary.total_scenes || 0}</span>
          <span className="ikpi-sub">Breakdown Count</span>
        </div>

        <div className="insights-kpi-card">
          <span className="ikpi-label">Shooting Days</span>
          <span className="ikpi-val">{summary.total_shoot_days || 0}</span>
          <span className="ikpi-sub">Schedule Length</span>
        </div>
      </div>

      {/* Analytics Perspectives Grid */}
      <div className="insights-grid-2col">
        {/* Top Cost Scenes */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>🎬 Highest Cost Scenes</h4>
          </div>
          <div className="panel-body">
            {highestCostScenes.length === 0 ? (
              <p className="muted-text">No cost breakdown data available.</p>
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

        {/* Cost by Location */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>📍 Cost Distribution by Location</h4>
          </div>
          <div className="panel-body">
            {costByLocation.length === 0 ? (
              <p className="muted-text">No location metric data available.</p>
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
                      <td className="text-gold">{formatCurrency(loc.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Department Budget Breakdown */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>💰 Category Allocation Breakdown</h4>
          </div>
          <div className="panel-body">
            {costByCategory.length === 0 ? (
              <p className="muted-text">No category data available.</p>
            ) : (
              <table className="insights-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {costByCategory.map((cat, idx) => (
                    <tr key={idx}>
                      <td><strong>{cat.category}</strong></td>
                      <td>{formatCurrency(cat.total_cost)}</td>
                      <td>{cat.pct_of_budget ? `${cat.pct_of_budget}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Production Complexity Breakdown */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>⚡ Scene Complexity Distribution</h4>
          </div>
          <div className="panel-body">
            {complexityDist.length === 0 ? (
              <p className="muted-text">No complexity metric data available.</p>
            ) : (
              <div className="complexity-badge-list">
                {complexityDist.map((comp, idx) => (
                  <div key={idx} className={`complexity-card complexity-${String(comp.production_complexity).toLowerCase()}`}>
                    <span className="comp-tag">{comp.production_complexity}</span>
                    <span className="comp-count">{comp.scene_count} Scene(s)</span>
                    <span className="comp-cost">{formatCurrency(comp.total_cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cast Load per Scene */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>👥 Cast Load per Scene</h4>
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
                    <th>Cast Count</th>
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

        {/* Major Cost Drivers */}
        <div className="insights-panel">
          <div className="panel-header">
            <h4>⚠️ Key Production Cost Drivers</h4>
          </div>
          <div className="panel-body">
            {majorDrivers.length === 0 ? (
              <p className="muted-text">No major cost driver records found.</p>
            ) : (
              <div className="cost-drivers-list">
                {majorDrivers.map((driver, idx) => (
                  <div key={idx} className="driver-item">
                    <div className="driver-header">
                      <span className="driver-factor">{driver.factor}</span>
                      <span className="driver-impact">+{formatCurrency(driver.impact)}</span>
                    </div>
                    {driver.explanation && <p className="driver-explanation">{driver.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
