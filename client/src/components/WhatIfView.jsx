import React, { useState } from 'react';

export function WhatIfView({ breakdown, budget, schedule }) {
  const baselineBudget = Number(budget?.estimated_total || budget?.target_budget || 5000000);
  const baselineDays = Number(schedule?.total_shoot_days || (Array.isArray(schedule?.days) ? schedule.days.length : 3));
  const scenes = Array.isArray(breakdown?.scenes) ? breakdown.scenes : [];
  const sceneCount = scenes.length;
  const locations = Array.from(new Set(scenes.map(s => s.location).filter(Boolean)));
  const locationCount = locations.length;
  const nightScenes = scenes.filter(s => String(s.time_of_day || s.time || '').toUpperCase().includes('NIGHT')).length;

  // Form State
  const [targetShootDays, setTargetShootDays] = useState(baselineDays);
  const [targetBudget, setTargetBudget] = useState(baselineBudget);

  // Status & Scenario State
  const [status, setStatus] = useState('idle'); // 'idle' | 'simulating' | 'success' | 'error'
  const [scenarioResult, setScenarioResult] = useState(null);
  const [appliedScenario, setAppliedScenario] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRunSimulation = async () => {
    setErrorMsg('');
    if (!breakdown || !budget || !schedule) {
      setErrorMsg('Complete production plan data is required for simulation.');
      setStatus('error');
      return;
    }

    const days = Number(targetShootDays);
    const bgt = Number(targetBudget);

    if (isNaN(days) || days <= 0) {
      setErrorMsg('Target shoot days must be a positive integer.');
      setStatus('error');
      return;
    }
    if (isNaN(bgt) || bgt <= 0) {
      setErrorMsg('Target budget must be a positive number.');
      setStatus('error');
      return;
    }

    setStatus('simulating');

    try {
      const response = await fetch('/api/production/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakdown,
          budget,
          schedule,
          targetShootDays: days,
          targetBudget: bgt
        })
      });

      const resData = await response.json();

      if (!response.ok || resData.status !== 'success') {
        throw new Error(resData.error || resData.details || 'Simulation failed.');
      }

      setScenarioResult(resData.data);
      setStatus('success');
    } catch (err) {
      console.error('[What-If Simulation UI Error]:', err);
      setErrorMsg(err.message || 'Failed to compute what-if scenario.');
      setStatus('error');
    }
  };

  const handleApplyScenario = () => {
    if (scenarioResult) {
      setAppliedScenario(scenarioResult);
    }
  };

  const handleResetToCurrentPlan = () => {
    setTargetShootDays(baselineDays);
    setTargetBudget(baselineBudget);
    setScenarioResult(null);
    setAppliedScenario(null);
    setErrorMsg('');
    setStatus('idle');
  };

  return (
    <div className="what-if-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="what-if-header" style={{ marginBottom: '24px', borderBottom: '1px solid #374151', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f3f4f6', margin: '0 0 8px 0' }}>
              PRODUCTION WHAT-IF
            </h2>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
              Explore production trade-offs before committing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetToCurrentPlan}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '6px',
              backgroundColor: '#374151',
              color: '#e5e7eb',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Reset to Current Plan
          </button>
        </div>
      </div>

      {/* Product Value Banner */}
      <div style={{ padding: '12px 16px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', fontSize: '13px', marginBottom: '24px' }}>
        💡 <strong>Producer Insight:</strong> CineAgent Studio does not just generate a production plan. It lets producers explore the consequences of changing constraints deterministically without mutating the baseline plan.
      </div>

      {/* Applied Scenario Banner */}
      {appliedScenario && (
        <div style={{ padding: '12px 16px', backgroundColor: '#064e3b', border: '1px solid #047857', color: '#a7f3d0', borderRadius: '6px', fontSize: '14px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📌 <strong>Active Scenario View:</strong> Derived What-If Scenario #{appliedScenario.scenario_id.substring(9, 14)} applied in session view. Canonical production plan remains unchanged.</span>
          <button
            onClick={handleResetToCurrentPlan}
            style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', backgroundColor: '#047857', color: '#ffffff', border: 'none', cursor: 'pointer' }}
          >
            Return to Baseline
          </button>
        </div>
      )}

      {/* Baseline Overview Grid */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e5e7eb', fontSize: '16px', marginBottom: '12px' }}>CURRENT PLAN</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Target Budget</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>
              ${baselineBudget.toLocaleString()}
            </div>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Shoot Days</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#60a5fa', marginTop: '4px' }}>
              {baselineDays} Days
            </div>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Scenes</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#f3f4f6', marginTop: '4px' }}>
              {sceneCount} Scenes
            </div>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Locations</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#f3f4f6', marginTop: '4px' }}>
              {locationCount} Locations
            </div>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>Night Scenes</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fbbf24', marginTop: '4px' }}>
              {nightScenes} Scenes
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Controls Box */}
      <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', border: '1px solid #374151', marginBottom: '24px' }}>
        <h3 style={{ color: '#e5e7eb', fontSize: '16px', margin: '0 0 16px 0' }}>SCENARIO CONTROLS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: '#d1d5db', marginBottom: '6px', fontWeight: '500' }}>
              Target Shoot Days
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="number"
                min="1"
                max="30"
                value={targetShootDays}
                onChange={(e) => setTargetShootDays(e.target.value)}
                disabled={status === 'simulating'}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#111827',
                  border: '1px solid #4b5563',
                  color: '#ffffff',
                  fontSize: '14px'
                }}
              />
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>Current: {baselineDays}d</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', color: '#d1d5db', marginBottom: '6px', fontWeight: '500' }}>
              Target Budget ($)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="number"
                min="1000"
                step="50000"
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
                disabled={status === 'simulating'}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#111827',
                  border: '1px solid #4b5563',
                  color: '#ffffff',
                  fontSize: '14px'
                }}
              />
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>Current: ${baselineBudget.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunSimulation}
          disabled={status === 'simulating'}
          className="btn btn-primary"
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '6px',
            cursor: status === 'simulating' ? 'not-allowed' : 'pointer',
            opacity: status === 'simulating' ? 0.6 : 1
          }}
        >
          {status === 'simulating' ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      {status === 'error' && errorMsg && (
        <div style={{ padding: '16px', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', borderRadius: '6px', marginBottom: '24px', fontSize: '14px' }}>
          ⚠️ <strong>What-If Simulation Error:</strong> {errorMsg}
        </div>
      )}

      {/* Simulation Results Section */}
      {status === 'success' && scenarioResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Comparison Table */}
          <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
            <h3 style={{ color: '#e5e7eb', fontSize: '16px', marginBottom: '16px' }}>SCENARIO COMPARISON</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af' }}>
                  <th style={{ padding: '10px' }}>METRIC</th>
                  <th style={{ padding: '10px' }}>CURRENT</th>
                  <th style={{ padding: '10px' }}>WHAT-IF</th>
                  <th style={{ padding: '10px' }}>DELTA</th>
                </tr>
              </thead>
              <tbody style={{ color: '#e5e7eb' }}>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '10px', fontWeight: '600' }}>Budget</td>
                  <td style={{ padding: '10px' }}>${scenarioResult.baseline.budget.toLocaleString()}</td>
                  <td style={{ padding: '10px' }}>${scenarioResult.target.budget.toLocaleString()}</td>
                  <td style={{ padding: '10px', color: scenarioResult.deltas.budget_delta < 0 ? '#ef4444' : scenarioResult.deltas.budget_delta > 0 ? '#10b981' : '#9ca3af' }}>
                    {scenarioResult.deltas.budget_delta > 0 ? '+' : ''}${scenarioResult.deltas.budget_delta.toLocaleString()} ({scenarioResult.deltas.budget_variance_pct}%)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', fontWeight: '600' }}>Shoot Days</td>
                  <td style={{ padding: '10px' }}>{scenarioResult.baseline.shoot_days} Days</td>
                  <td style={{ padding: '10px' }}>{scenarioResult.target.shoot_days} Days</td>
                  <td style={{ padding: '10px', color: scenarioResult.deltas.shoot_days_delta < 0 ? '#ef4444' : scenarioResult.deltas.shoot_days_delta > 0 ? '#10b981' : '#9ca3af' }}>
                    {scenarioResult.deltas.shoot_days_delta > 0 ? '+' : ''}{scenarioResult.deltas.shoot_days_delta} Days ({scenarioResult.deltas.days_compression_pct > 0 ? `-${scenarioResult.deltas.days_compression_pct}% compressed` : 'extended'})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Trade-Offs */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#60a5fa', margin: '0 0 12px 0', fontSize: '15px' }}>⚖️ TRADE-OFFS</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {scenarioResult.tradeoffs.map((item, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 12px 0', fontSize: '15px' }}>⚠️ RISKS</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {scenarioResult.risks.map((item, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Affected Areas */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#fbbf24', margin: '0 0 12px 0', fontSize: '15px' }}>📍 AFFECTED AREAS</h4>
              {scenarioResult.affected_scenes.length > 0 && (
                <p style={{ margin: '0 0 8px 0', color: '#e5e7eb', fontSize: '14px' }}>
                  <strong>Affected Scenes:</strong> Scene #{scenarioResult.affected_scenes.join(', #')}
                </p>
              )}
              {scenarioResult.affected_locations.length > 0 && (
                <p style={{ margin: '0 0 12px 0', color: '#e5e7eb', fontSize: '14px' }}>
                  <strong>Locations Under Move Pressure:</strong> {scenarioResult.affected_locations.join(', ')}
                </p>
              )}
              {scenarioResult.cost_pressure_categories.length > 0 && (
                <div>
                  <strong style={{ color: '#9ca3af', fontSize: '13px' }}>Cost Pressure Categories:</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: '#d1d5db', fontSize: '13px' }}>
                    {scenarioResult.cost_pressure_categories.map((cat, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        {cat.category} (${cat.current_cost.toLocaleString()}) — <span style={{ color: cat.status.includes('Potential') ? '#fbbf24' : '#9ca3af' }}>{cat.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Assumptions */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#34d399', margin: '0 0 12px 0', fontSize: '15px' }}>📋 EXPLICIT ASSUMPTIONS</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {scenarioResult.assumptions.map((item, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleApplyScenario}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Apply Scenario
            </button>
            <button
              type="button"
              onClick={handleResetToCurrentPlan}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                backgroundColor: '#374151',
                color: '#e5e7eb',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reset to Current Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatIfView;
