import React from 'react';

export default function BudgetView({ budget }) {
  if (!budget) {
    return (
      <div className="card empty-state-card">
        <p>No budget intelligence data available.</p>
      </div>
    );
  }

  const formatCurrency = (val) => {
    if (typeof val !== 'number') return '$0';
    return '$' + val.toLocaleString();
  };

  const statusClass =
    budget.budget_status === 'UNDER_TARGET'
      ? 'status-under'
      : budget.budget_status === 'OVER_TARGET'
      ? 'status-over'
      : 'status-at';

  const total = budget.estimated_total || 1;
  const categories = budget.categories || [];
  const reconciliation = budget.budget_reconciliation || {};
  const recommendations = budget.recommendations || budget.cost_saving_recommendations || [];

  return (
    <div className="budget-workspace">
      {/* Top Financial KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Estimated Budget</span>
          <span className="kpi-val highlight-gold">{formatCurrency(budget.estimated_total)}</span>
          <span className="kpi-sub">Total Line-Item Forecast</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Target Budget</span>
          <span className="kpi-val">{formatCurrency(budget.target_budget)}</span>
          <span className="kpi-sub">Producer Cap</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Budget Status</span>
          <span className={`kpi-badge ${statusClass}`}>
            {budget.budget_status ? budget.budget_status.replace('_', ' ') : 'PENDING'}
          </span>
          <span className="kpi-sub">Variance vs Target</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Variance</span>
          <span className={`kpi-val ${budget.budget_variance < 0 || budget.target_variance < 0 ? 'text-green' : (budget.budget_variance > 0 || budget.target_variance > 0) ? 'text-red' : ''}`}>
            {(budget.budget_variance ?? budget.target_variance ?? 0) > 0 ? '+' : ''}
            {formatCurrency(budget.budget_variance ?? budget.target_variance ?? 0)}
          </span>
          <span className="kpi-sub">{(budget.budget_variance ?? budget.target_variance ?? 0) <= 0 ? 'Within Allocation' : 'Exceeds Allocation'}</span>
        </div>
      </div>

      {/* Budget Reconciliation Panel */}
      {reconciliation && reconciliation.estimated_total && (
        <div className="reconciliation-panel">
          <div className="reconciliation-header">
            <h4>Deterministic Budget Reconciliation</h4>
            <span className="reconcile-badge">Verified Traceability</span>
          </div>

          <div className="reconciliation-formula-bar">
            <div className="recon-step">
              <span className="recon-step-label">Scene-Linked Costs</span>
              <span className="recon-step-val">{formatCurrency(reconciliation.scene_linked_cost_total)}</span>
              <span className="recon-step-desc">Sum of Scene Breakdown</span>
            </div>
            <div className="recon-operator">+</div>
            <div className="recon-step">
              <span className="recon-step-label">Project-Wide Costs</span>
              <span className="recon-step-val">{formatCurrency(reconciliation.project_wide_cost_total)}</span>
              <span className="recon-step-desc">Crew, Gear, Locations, Post</span>
            </div>
            <div className="recon-operator">+</div>
            <div className="recon-step">
              <span className="recon-step-label">Contingency</span>
              <span className="recon-step-val">{formatCurrency(reconciliation.contingency_cost)}</span>
              <span className="recon-step-desc">Risk Reserve Buffer</span>
            </div>
            <div className="recon-operator">=</div>
            <div className="recon-step recon-total">
              <span className="recon-step-label">Estimated Total</span>
              <span className="recon-step-val highlight-gold">{formatCurrency(reconciliation.estimated_total)}</span>
              <span className="recon-step-desc">Final Production Estimate</span>
            </div>
          </div>

          {reconciliation.explanation && (
            <div className="recon-explanation-box">
              <strong>Reconciliation Rationale:</strong> {reconciliation.explanation}
            </div>
          )}
        </div>
      )}

      {/* Two Column Layout: Categories & Cost Drivers */}
      <div className="budget-columns-grid">
        {/* Left Column: Department Category Breakdown */}
        <div className="budget-card">
          <div className="card-header-simple">
            <h4>Department Category Allocations</h4>
            <span className="category-count">{categories.length} Categories</span>
          </div>

          <div className="categories-list">
            {categories.map((cat, idx) => {
              const catCost = cat.estimated_cost ?? cat.cost ?? 0;
              const pct = Math.round((catCost / total) * 100);
              return (
                <div key={idx} className="category-row">
                  <div className="cat-title-row">
                    <span className="cat-name">{cat.category}</span>
                    <span className="cat-cost">{formatCurrency(catCost)} <span className="cat-pct">({pct}%)</span></span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  {cat.explanation && (
                    <p className="cat-explanation">{cat.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Major Cost Drivers & Recommendations */}
        <div className="budget-side-column">
          {/* Major Cost Drivers */}
          <div className="budget-card">
            <div className="card-header-simple">
              <h4>Major Cost Drivers</h4>
              <span className="badge-impact">High Impact</span>
            </div>

            <div className="drivers-list">
              {budget.major_cost_drivers && budget.major_cost_drivers.length > 0 ? (
                budget.major_cost_drivers.map((driver, i) => (
                  <div key={i} className="driver-card">
                    <div className="driver-top">
                      <span className="driver-factor">{driver.factor || `Cost Factor ${i + 1}`}</span>
                      <span className="driver-cost">{formatCurrency(driver.impact ?? driver.impact_amount ?? 0)}</span>
                    </div>
                    <p className="driver-desc">{driver.explanation}</p>
                  </div>
                ))
              ) : (
                <p className="none-text">No significant cost drivers flagged.</p>
              )}
            </div>
          </div>

          {/* Cost-Saving Recommendations */}
          {recommendations.length > 0 && (
            <div className="budget-card recommendations-card">
              <div className="card-header-simple">
                <h4>Producer Optimization Recommendations</h4>
              </div>
              <ul className="recommendation-list">
                {recommendations.map((rec, i) => (
                  <li key={i}>
                    {typeof rec === 'string'
                      ? rec
                      : `${rec.recommendation}${rec.potential_savings ? ` (Est. Savings: ${formatCurrency(rec.potential_savings)})` : ''}${rec.rationale ? ` — ${rec.rationale}` : ''}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assumptions */}
          {budget.assumptions && budget.assumptions.length > 0 && (
            <div className="budget-card assumptions-card">
              <div className="card-header-simple">
                <h4>Budgeting Assumptions</h4>
              </div>
              <ul className="assumptions-list">
                {budget.assumptions.map((asm, i) => (
                  <li key={i}>{typeof asm === 'string' ? asm : JSON.stringify(asm)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
