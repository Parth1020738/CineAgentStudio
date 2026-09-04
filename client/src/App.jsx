import React, { useState, useEffect } from 'react';
import './App.css';
import BreakdownView from './components/BreakdownView.jsx';
import BudgetView from './components/BudgetView.jsx';
import ScheduleView from './components/ScheduleView.jsx';
import ProductionInsightsView from './components/ProductionInsightsView.jsx';
import ExportView from './components/ExportView.jsx';
import ScriptDoctorView from './components/ScriptDoctorView.jsx';
import WhatIfView from './components/WhatIfView.jsx';

export default function App() {
  const [formData, setFormData] = useState({
    title: 'Neon Horizon',
    genre: 'Sci-Fi Cyberpunk',
    logline: 'A rogue AI hunted by its creator uncovers a city-wide conspiracy.',
    tone: 'Neo-Noir, Gritty',
    targetBudget: '5000000',
    targetShootDays: '3',
    screenplayDetail: 'cinematic',
    projectId: ''
  });

  const [pipelineState, setPipelineState] = useState({
    loading: false,
    stage: 'idle',
    progressPct: 0,
    statusText: '',
    errorMsg: null,
    pipelineMode: 'full' // 'full' | 'screenplay_only'
  });

  const [resultData, setResultData] = useState({
    projectId: null,
    storyPackage: null,
    screenplay: null,
    breakdown: null,
    budget: null,
    schedule: null,
    productionInsights: null,
    pipelineTelemetry: null
  });

  // Navigation tab states: 'concept' | 'story' | 'screenplay' | 'production' | 'script_doctor' | 'what_if' | 'export'
  const [mainTab, setMainTab] = useState('concept');
  const [planningSubTab, setPlanningSubTab] = useState('breakdown'); // 'breakdown' | 'budget' | 'schedule' | 'insights'

  const [systemHealth, setSystemHealth] = useState({
    geminiConnected: false,
    mcpConnected: false,
    adkInitialized: false
  });

  useEffect(() => {
    // Perform initial system health checks via Node Gateway
    fetch('/api/agent/health')
      .then((res) => res.json())
      .then((data) => {
        setSystemHealth((prev) => ({
          ...prev,
          adkInitialized: true,
          geminiConnected: Boolean(data.details?.geminiConnected)
        }));
      })
      .catch(() => {});

    fetch('/api/mcp/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'connected') {
          setSystemHealth((prev) => ({
            ...prev,
            mcpConnected: true
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 1. Full Production Plan Generator (5-Agent E2E Pipeline)
  const handleGenerateProductionPlan = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title.trim()) {
      setPipelineState((prev) => ({ ...prev, errorMsg: 'Film Title is required.', stage: 'error' }));
      return;
    }
    if (!formData.genre.trim()) {
      setPipelineState((prev) => ({ ...prev, errorMsg: 'Genre is required.', stage: 'error' }));
      return;
    }
    if (!formData.logline.trim()) {
      setPipelineState((prev) => ({ ...prev, errorMsg: 'Logline is required.', stage: 'error' }));
      return;
    }

    setPipelineState({
      loading: true,
      stage: 'story_agent',
      progressPct: 15,
      statusText: '1/6 Story Agent developing narrative architecture & character roster...',
      errorMsg: null,
      pipelineMode: 'full'
    });
    setResultData({
      projectId: null,
      storyPackage: null,
      screenplay: null,
      breakdown: null,
      budget: null,
      schedule: null,
      productionInsights: null,
      pipelineTelemetry: null
    });

    const t1 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'screenplay_agent',
        progressPct: 35,
        statusText: '2/6 Screenplay Agent formatting industry-standard scenes & dialogue...'
      }));
    }, 12000);

    const t2 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'breakdown_agent',
        progressPct: 55,
        statusText: '3/6 Production Breakdown Agent extracting scene assets, cast & equipment...'
      }));
    }, 28000);

    const t3 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'budget_agent',
        progressPct: 75,
        statusText: '4/6 Budget Agent estimating category costs & verifying reconciliation...'
      }));
    }, 45000);

    const t4 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'schedule_agent',
        progressPct: 90,
        statusText: '5/6 Schedule Agent optimizing shooting days, night blocks & location moves...'
      }));
    }, 62000);

    try {
      const response = await fetch('/api/pipeline/production-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          targetShootDays: formData.targetShootDays ? Number(formData.targetShootDays) : undefined
        })
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);

      const resData = await response.json();

      if (!response.ok) {
        if (resData.error === 'GEMINI_RATE_LIMITED' || response.status === 429) {
          throw new Error('Gemini daily limit reached. Please wait for the quota to reset and try again.');
        }
        throw new Error(resData.message || resData.error || 'Production Planning pipeline execution failed.');
      }

      setPipelineState({
        loading: false,
        stage: 'complete',
        progressPct: 100,
        statusText: resData.data?.isDemoData ? 'Complete Production Plan loaded (LOCAL DEMO DATA).' : '6/6 Complete Production Plan generated & synced to ClickHouse Cloud!',
        errorMsg: null,
        pipelineMode: 'full'
      });

      setResultData({
        isDemoData: Boolean(resData.data?.isDemoData),
        projectId: resData.data.projectId,
        storyPackage: resData.data.storyPackage,
        screenplay: resData.data.screenplay,
        breakdown: resData.data.breakdown,
        budget: resData.data.budget,
        schedule: resData.data.schedule,
        productionInsights: resData.data.productionInsights,
        pipelineTelemetry: resData.data.pipelineTelemetry
      });

      setMainTab('production');
      setPlanningSubTab('breakdown');
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);

      setPipelineState({
        loading: false,
        stage: 'error',
        progressPct: 0,
        statusText: '',
        errorMsg: err.message || 'Network error connecting to CineAgent Studio gateway.',
        pipelineMode: 'full'
      });
    }
  };

  // 2. Story & Screenplay Draft Only (Backwards-compatible)
  const handleGenerateStoryScreenplay = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title.trim() || !formData.genre.trim() || !formData.logline.trim()) {
      setPipelineState((prev) => ({ ...prev, errorMsg: 'Title, Genre, and Logline are required.', stage: 'error' }));
      return;
    }

    setPipelineState({
      loading: true,
      stage: 'story_agent',
      progressPct: 30,
      statusText: 'Drafting narrative package...',
      errorMsg: null,
      pipelineMode: 'screenplay_only'
    });
    setResultData({
      isDemoData: false,
      projectId: null,
      storyPackage: null,
      screenplay: null,
      breakdown: null,
      budget: null,
      schedule: null,
      productionInsights: null,
      pipelineTelemetry: null
    });

    try {
      const response = await fetch('/api/pipeline/story-to-screenplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData
        })
      });

      const resData = await response.json();

      if (!response.ok) {
        if (resData.error === 'GEMINI_RATE_LIMITED' || response.status === 429) {
          throw new Error('Gemini daily limit reached. Please wait for the quota to reset and try again.');
        }
        throw new Error(resData.message || resData.error || 'Story & Screenplay generation failed.');
      }

      setPipelineState({
        loading: false,
        stage: 'complete',
        progressPct: 100,
        statusText: 'Story & Screenplay draft generated successfully!',
        errorMsg: null,
        pipelineMode: 'screenplay_only'
      });

      setResultData({
        isDemoData: Boolean(resData.data?.isDemoData),
        projectId: resData.data.projectId,
        storyPackage: resData.data.storyPackage,
        screenplay: resData.data.screenplay,
        breakdown: null,
        budget: null,
        schedule: null,
        productionInsights: null,
        pipelineTelemetry: resData.data.pipelineTelemetry
      });

      setMainTab('screenplay');
    } catch (err) {
      setPipelineState({
        loading: false,
        stage: 'error',
        progressPct: 0,
        statusText: '',
        errorMsg: err.message || 'Network error connecting to CineAgent Studio gateway.',
        pipelineMode: 'screenplay_only'
      });
    }
  };

  // Compute Pipeline Stage Indicators
  const getStageIndicator = (stageKey) => {
    if (pipelineState.stage === 'error') {
      if (
        (stageKey === 'concept' && !formData.title) ||
        (stageKey === 'story' && pipelineState.stage === 'error')
      ) {
        return { symbol: '⚠', text: 'Error', className: 'stage-error' };
      }
    }

    if (stageKey === 'concept') {
      return resultData.storyPackage || formData.title
        ? { symbol: '✓', text: 'Complete', className: 'stage-complete' }
        : { symbol: '●', text: 'Active', className: 'stage-active' };
    }

    if (stageKey === 'story') {
      if (resultData.storyPackage) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.loading && pipelineState.stage === 'story_agent')
        return { symbol: '●', text: 'In Progress', className: 'stage-active' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    if (stageKey === 'screenplay') {
      if (resultData.screenplay) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.loading && pipelineState.stage === 'screenplay_agent')
        return { symbol: '●', text: 'In Progress', className: 'stage-active' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    if (stageKey === 'breakdown') {
      if (resultData.breakdown) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.loading && pipelineState.stage === 'breakdown_agent')
        return { symbol: '●', text: 'In Progress', className: 'stage-active' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    if (stageKey === 'budget') {
      if (resultData.budget) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.loading && pipelineState.stage === 'budget_agent')
        return { symbol: '●', text: 'In Progress', className: 'stage-active' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    if (stageKey === 'schedule') {
      if (resultData.schedule) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.loading && pipelineState.stage === 'schedule_agent')
        return { symbol: '●', text: 'In Progress', className: 'stage-active' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    if (stageKey === 'insights') {
      if (resultData.productionInsights) return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      if (pipelineState.stage === 'complete') return { symbol: '✓', text: 'Complete', className: 'stage-complete' };
      return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
    }

    return { symbol: '○', text: 'Not Started', className: 'stage-idle' };
  };

  const hasPlan = Boolean(resultData.storyPackage || resultData.screenplay);
  const formattedBudget = resultData.budget?.estimated_total
    ? `$${(resultData.budget.estimated_total / 1000000).toFixed(1)}M`
    : resultData.budget?.target_budget
    ? `$${(resultData.budget.target_budget / 1000000).toFixed(1)}M`
    : `$${(Number(formData.targetBudget) / 1000000).toFixed(1)}M`;
  const shootDaysCount = resultData.schedule?.total_shoot_days || formData.targetShootDays || 3;
  const sceneCount = resultData.breakdown?.scenes?.length || resultData.screenplay?.scenes?.length || 0;
  const locationCount = resultData.breakdown?.locations?.length || (resultData.breakdown?.scenes ? new Set(resultData.breakdown.scenes.map(s => s.location).filter(Boolean)).size : 0);

  return (
    <div className="app-container">
      {/* Top Header & System Health Bar */}
      <header className="studio-header">
        <div className="header-brand">
          <div className="clapper-icon">🎬</div>
          <div>
            <h1>CINEAGENT STUDIO</h1>
            <p className="tagline">AI Film Production Command Center</p>
          </div>
        </div>

        <div className="health-bar">
          {resultData.isDemoData && (
            <div className="health-badge demo-badge" style={{ backgroundColor: '#78350f', color: '#fef3c7', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', border: '1px solid #f59e0b' }}>
              LOCAL DEMO DATA
            </div>
          )}
          <div className={`health-badge ${systemHealth.adkInitialized ? 'healthy' : 'degraded'}`}>
            <span className="dot"></span> Google ADK
          </div>
          <div className={`health-badge ${systemHealth.geminiConnected ? 'healthy' : 'degraded'}`}>
            <span className="dot"></span> Gemini API
          </div>
          <div className={`health-badge ${systemHealth.mcpConnected ? 'healthy' : 'disconnected'}`}>
            <span className="dot"></span> ClickHouse MCP
          </div>
        </div>
      </header>

      {/* Persistent Project Header (Visible when plan exists) */}
      {hasPlan && (
        <section className="card project-header-card" aria-label="Persistent Project Header">
          <div className="p-header-top">
            <div className="p-title-group">
              <h2 className="p-title">{resultData.storyPackage?.title || formData.title}</h2>
              <p className="p-meta">{resultData.storyPackage?.genre || formData.genre} • {formData.tone}</p>
            </div>
            <div className="p-metrics-strip">
              <div className="p-metric-item">
                <span className="pm-label">BUDGET</span>
                <span className="pm-val highlight-gold">{formattedBudget}</span>
              </div>
              <div className="p-metric-item">
                <span className="pm-label">SHOOT DAYS</span>
                <span className="pm-val text-blue">{shootDaysCount} Days</span>
              </div>
              <div className="p-metric-item">
                <span className="pm-label">SCENES</span>
                <span className="pm-val">{sceneCount} Scenes</span>
              </div>
              <div className="p-metric-item">
                <span className="pm-label">LOCATIONS</span>
                <span className="pm-val">{locationCount} Locations</span>
              </div>
            </div>
          </div>
          <p className="p-logline">"{resultData.storyPackage?.logline || formData.logline}"</p>
        </section>
      )}

      {/* Visual Pipeline Status Indicator */}
      <section className="card pipeline-status-card" aria-label="Production Pipeline Status">
        <div className="pipeline-status-header">
          <h3>PRODUCTION PIPELINE STATUS</h3>
          {pipelineState.loading && (
            <span className="pipeline-running-badge">● Pipeline Running</span>
          )}
        </div>
        <div className="pipeline-flow-bar">
          {[
            { key: 'concept', label: 'CONCEPT' },
            { key: 'story', label: 'STORY' },
            { key: 'screenplay', label: 'SCREENPLAY' },
            { key: 'breakdown', label: 'BREAKDOWN' },
            { key: 'budget', label: 'BUDGET' },
            { key: 'schedule', label: 'SCHEDULE' },
            { key: 'insights', label: 'INSIGHTS' }
          ].map((item, idx, arr) => {
            const ind = getStageIndicator(item.key);
            return (
              <React.Fragment key={item.key}>
                <div className={`pipeline-step-node ${ind.className}`}>
                  <span className="step-symbol">{ind.symbol}</span>
                  <span className="step-name">{item.label}</span>
                </div>
                {idx < arr.length - 1 && <span className="pipeline-arrow">→</span>}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* Primary Lifecycle Navigation Bar */}
      <nav className="primary-lifecycle-nav card" aria-label="Primary Navigation">
        <div className="nav-lifecycle-buttons">
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'concept' ? 'active' : ''}`}
            onClick={() => setMainTab('concept')}
          >
            💡 CONCEPT
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'story' ? 'active' : ''}`}
            onClick={() => setMainTab('story')}
            disabled={!resultData.storyPackage}
          >
            📖 STORY
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'screenplay' ? 'active' : ''}`}
            onClick={() => setMainTab('screenplay')}
            disabled={!resultData.screenplay}
          >
            📜 SCREENPLAY
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'production' ? 'active' : ''}`}
            onClick={() => setMainTab('production')}
            disabled={!resultData.breakdown}
          >
            🎬 PRODUCTION
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'script_doctor' ? 'active' : ''}`}
            onClick={() => setMainTab('script_doctor')}
            disabled={!resultData.screenplay}
          >
            🩺 SCRIPT DOCTOR
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'what_if' ? 'active' : ''}`}
            onClick={() => setMainTab('what_if')}
            disabled={!resultData.breakdown}
          >
            ⚡ WHAT-IF
          </button>
          <button
            type="button"
            className={`lifecycle-btn ${mainTab === 'export' ? 'active' : ''}`}
            onClick={() => setMainTab('export')}
            disabled={!resultData.storyPackage}
          >
            📦 EXPORT
          </button>
        </div>
      </nav>

      {/* Main Content Views */}
      <main className="main-content">
        {/* Progress & Error Cards */}
        {pipelineState.loading && (
          <section className="card progress-card">
            <div className="progress-header-row">
              <h3>Multi-Agent Pipeline Execution</h3>
              <span className="progress-pct-badge">{pipelineState.progressPct}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${pipelineState.progressPct}%` }}
              ></div>
            </div>
            <p className="progress-text">{pipelineState.statusText}</p>
          </section>
        )}

        {pipelineState.stage === 'error' && (
          <div className="card error-card">
            <h3>⚠️ Pipeline Execution Error</h3>
            <p>{pipelineState.errorMsg}</p>
          </div>
        )}

        {/* TAB 1: CONCEPT INTAKE & DASHBOARD OVERVIEW */}
        {mainTab === 'concept' && (
          <div className="concept-workspace">
            {/* Project Overview & Quick Actions (If Plan Exists) */}
            {hasPlan && (
              <section className="card dashboard-overview-card" aria-label="Project Overview Dashboard">
                <div className="card-header">
                  <div>
                    <h2>Project Overview Dashboard</h2>
                    <p className="section-subtitle">Command center view for producers and project leads.</p>
                  </div>
                  <span className="badge agent-badge">Active Plan Loaded</span>
                </div>

                <div className="quick-actions-bar">
                  <span className="qa-label">QUICK ACTIONS</span>
                  <div className="qa-buttons">
                    <button
                      type="button"
                      className="btn btn-primary qa-btn"
                      onClick={() => setMainTab('script_doctor')}
                    >
                      🩺 Review My Script
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary qa-btn"
                      onClick={() => setMainTab('what_if')}
                    >
                      ⚡ Explore What-If
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary qa-btn"
                      onClick={() => {
                        setMainTab('production');
                        setPlanningSubTab('breakdown');
                      }}
                    >
                      🎬 View Production Plan
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary qa-btn"
                      onClick={() => setMainTab('export')}
                    >
                      📦 Export Production Bible
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Concept Intake Form */}
            <section className="card form-card" aria-label="Film Concept Intake">
              <div className="card-header">
                <div>
                  <h2>PROJECT CONCEPT</h2>
                  <p className="section-subtitle">Turn a film concept into a production-ready plan.</p>
                </div>
                <span className="badge">Studio Intake Desk</span>
              </div>

              <form className="concept-form">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Film Title <span className="req">*</span></label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g., Neon Horizon"
                      disabled={pipelineState.loading}
                      required
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Genre <span className="req">*</span></label>
                    <input
                      type="text"
                      name="genre"
                      value={formData.genre}
                      onChange={handleInputChange}
                      placeholder="e.g., Sci-Fi Cyberpunk"
                      disabled={pipelineState.loading}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Logline Concept <span className="req">*</span></label>
                  <textarea
                    name="logline"
                    value={formData.logline}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="A high-concept one-sentence summary of your film."
                    disabled={pipelineState.loading}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Tone / Visual Style</label>
                    <input
                      type="text"
                      name="tone"
                      value={formData.tone}
                      onChange={handleInputChange}
                      placeholder="e.g., Neo-Noir, Gritty, Atmospheric"
                      disabled={pipelineState.loading}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Target Budget ($)</label>
                    <input
                      type="number"
                      name="targetBudget"
                      value={formData.targetBudget}
                      onChange={handleInputChange}
                      placeholder="e.g., 5000000"
                      disabled={pipelineState.loading}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Target Shoot Days</label>
                    <input
                      type="number"
                      name="targetShootDays"
                      value={formData.targetShootDays}
                      onChange={handleInputChange}
                      placeholder="e.g., 3"
                      disabled={pipelineState.loading}
                    />
                  </div>

                  <div className="form-group flex-1 detail-level-group">
                    <label>Screenplay Detail Level</label>
                    <select
                      name="screenplayDetail"
                      value={formData.screenplayDetail}
                      onChange={handleInputChange}
                      disabled={pipelineState.loading}
                    >
                      <option value="concise">Concise (Lean & Fast-Paced)</option>
                      <option value="cinematic">Cinematic (Vivid & Atmospheric)</option>
                      <option value="highly_detailed">Highly Detailed (Sensory & Immersive)</option>
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Project ID (Optional)</label>
                    <input
                      type="text"
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleInputChange}
                      placeholder="auto-generated if empty"
                      disabled={pipelineState.loading}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="actions-bar">
                  <button
                    type="button"
                    className="submit-btn primary-plan-btn"
                    onClick={handleGenerateProductionPlan}
                    disabled={pipelineState.loading}
                  >
                    {pipelineState.loading && pipelineState.pipelineMode === 'full' ? (
                      <>
                        <span className="spinner"></span> Executing 5-Agent Production Pipeline...
                      </>
                    ) : (
                      '🚀 GENERATE PRODUCTION PLAN'
                    )}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleGenerateStoryScreenplay}
                    disabled={pipelineState.loading}
                  >
                    {pipelineState.loading && pipelineState.pipelineMode === 'screenplay_only' ? (
                      <>
                        <span className="spinner"></span> Generating Draft...
                      </>
                    ) : (
                      '📜 Draft Story & Screenplay Only'
                    )}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* TAB 2: STORY PACKAGE */}
        {mainTab === 'story' && resultData.storyPackage && (
          <section className="card story-card" aria-label="Story Package Architecture">
            <div className="card-header">
              <h2>Story Package Architecture</h2>
              <span className="badge agent-badge">Story Agent (Gemini)</span>
            </div>

            <div className="story-meta">
              <div className="meta-block">
                <h4>Logline</h4>
                <p className="logline-text">{resultData.storyPackage.logline}</p>
              </div>

              <div className="meta-block">
                <h4>Synopsis</h4>
                <p className="synopsis-text">{resultData.storyPackage.synopsis}</p>
              </div>
            </div>

            {resultData.storyPackage.three_act_structure && (
              <div className="three-act-grid">
                <div className="act-box">
                  <h4>Act 1 — Setup</h4>
                  <p>{resultData.storyPackage.three_act_structure.act1}</p>
                </div>
                <div className="act-box">
                  <h4>Act 2 — Confrontation</h4>
                  <p>{resultData.storyPackage.three_act_structure.act2}</p>
                </div>
                <div className="act-box">
                  <h4>Act 3 — Resolution</h4>
                  <p>{resultData.storyPackage.three_act_structure.act3}</p>
                </div>
              </div>
            )}

            {resultData.storyPackage.characters && (
              <div className="characters-section">
                <h3>Character Roster</h3>
                <div className="character-grid">
                  {resultData.storyPackage.characters.map((char, i) => (
                    <div key={i} className="character-card">
                      <div className="char-header">
                        <span className="char-name">{char.name}</span>
                        <span className="char-role">{char.role}</span>
                      </div>
                      <p className="char-desc">{char.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: SCREENPLAY VIEW */}
        {mainTab === 'screenplay' && resultData.screenplay && (
          <section className="card screenplay-card" aria-label="Formatted Screenplay Output">
            <div className="card-header">
              <div>
                <h2>Formatted Screenplay Output</h2>
                <span className="badge screenplay-badge" style={{ marginTop: '4px', display: 'inline-block' }}>
                  Detail Level: {formData.screenplayDetail === 'concise' ? 'Concise' : formData.screenplayDetail === 'highly_detailed' ? 'Highly Detailed' : 'Cinematic'}
                </span>
              </div>
              <span className="badge agent-badge">Screenplay Agent (Gemini)</span>
            </div>

            <div className="screenplay-paper">
              <div className="screenplay-title-block">
                <h1 className="screenplay-title">{resultData.screenplay.title.toUpperCase()}</h1>
                <p className="screenplay-byline">Written by CineAgent Studio Screenplay Agent</p>
                <p className="screenplay-proj">Project ID: {resultData.projectId}</p>
              </div>

              <div className="screenplay-scenes">
                {resultData.screenplay.scenes.map((scene) => (
                  <div key={scene.scene_number} className="scene-block">
                    <div className="scene-heading-bar">
                      <span className="scene-no">SCENE {scene.scene_number}</span>
                      <span className="scene-slug">{scene.scene_heading}</span>
                    </div>

                    <div className="action-block">
                      <p>{scene.action}</p>
                    </div>

                    {scene.dialogue && scene.dialogue.length > 0 && (
                      <div className="dialogue-container">
                        {scene.dialogue.map((d, dIdx) => (
                          <div key={dIdx} className="dialogue-block">
                            <div className="character-name">{d.character.toUpperCase()}</div>
                            {d.parenthetical && (
                              <div className="parenthetical">({d.parenthetical})</div>
                            )}
                            <div className="dialogue-line">{d.line}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {scene.transition && (
                      <div className="transition-block">
                        {scene.transition}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: PRODUCTION VIEWS */}
        {mainTab === 'production' && (
          <div className="production-planning-container">
            {/* Sub-Navigation Bar inside Production View */}
            <div className="planning-subnav card" aria-label="Production Sub Navigation">
              <button
                type="button"
                className={`subnav-btn ${planningSubTab === 'breakdown' ? 'active' : ''}`}
                onClick={() => setPlanningSubTab('breakdown')}
              >
                📋 Breakdown ({resultData.breakdown?.scenes?.length || 0} Scenes)
              </button>
              <button
                type="button"
                className={`subnav-btn ${planningSubTab === 'budget' ? 'active' : ''}`}
                onClick={() => setPlanningSubTab('budget')}
              >
                💰 Budget
              </button>
              <button
                type="button"
                className={`subnav-btn ${planningSubTab === 'schedule' ? 'active' : ''}`}
                onClick={() => setPlanningSubTab('schedule')}
              >
                📅 Schedule ({resultData.schedule?.total_shoot_days || 0} Days)
              </button>
              <button
                type="button"
                className={`subnav-btn ${planningSubTab === 'insights' ? 'active' : ''}`}
                onClick={() => setPlanningSubTab('insights')}
              >
                📊 Insights
              </button>
            </div>

            {/* Sub-View 1: Breakdown */}
            {planningSubTab === 'breakdown' && (
              <BreakdownView breakdown={resultData.breakdown} />
            )}

            {/* Sub-View 2: Budget */}
            {planningSubTab === 'budget' && (
              <BudgetView budget={resultData.budget} />
            )}

            {/* Sub-View 3: Schedule */}
            {planningSubTab === 'schedule' && (
              <ScheduleView schedule={resultData.schedule} />
            )}

            {/* Sub-View 4: Insights */}
            {planningSubTab === 'insights' && (
              <ProductionInsightsView
                insights={resultData.productionInsights}
                projectId={resultData.projectId}
              />
            )}
          </div>
        )}

        {/* TAB 5: SCRIPT DOCTOR */}
        {mainTab === 'script_doctor' && (
          <section className="card script-doctor-card">
            <ScriptDoctorView screenplay={resultData.screenplay} />
          </section>
        )}

        {/* TAB 6: WHAT-IF SIMULATOR */}
        {mainTab === 'what_if' && (
          <section className="card what-if-card">
            <WhatIfView
              breakdown={resultData.breakdown}
              budget={resultData.budget}
              schedule={resultData.schedule}
            />
          </section>
        )}

        {/* TAB 7: EXPORT WORKSPACE */}
        {mainTab === 'export' && (
          <section className="card export-card">
            <ExportView
              productionPlan={resultData}
              isDemoData={resultData.isDemoData}
            />
          </section>
        )}

        {/* Telemetry Footer */}
        {resultData.pipelineTelemetry && (
          <section className="card telemetry-card" aria-label="Pipeline Telemetry">
            <div className="card-header">
              <h2>Multi-Agent Pipeline Telemetry</h2>
              <span className="badge telemetry-badge">ClickHouse Cloud via MCP</span>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-item">
                <span className="t-label">Pipeline Status</span>
                <span className="t-val status-success">
                  {resultData.pipelineTelemetry.status || 'SUCCESS'}
                </span>
              </div>

              <div className="telemetry-item">
                <span className="t-label">Project ID</span>
                <span className="t-val">{resultData.projectId}</span>
              </div>

              <div className="telemetry-item">
                <span className="t-label">Total Execution Duration</span>
                <span className="t-val">
                  {resultData.pipelineTelemetry.totalDurationMs ?? resultData.pipelineTelemetry.durationMs ?? resultData.pipelineTelemetry.total_duration_ms ?? 0} ms
                </span>
              </div>

              <div className="telemetry-item">
                <span className="t-label">ClickHouse MCP Telemetry</span>
                <span className={`t-val ${(resultData.pipelineTelemetry.mcpLogged || resultData.pipelineTelemetry.mcpStatus === 'CONNECTED / SYNCED' || resultData.productionInsights?.clickHouseConnected) ? 'status-success' : 'status-disabled'}`}>
                  {resultData.pipelineTelemetry.mcpStatus || (resultData.pipelineTelemetry.mcpLogged || resultData.productionInsights?.clickHouseConnected ? 'CONNECTED / SYNCED' : 'DISABLED / UNAVAILABLE')}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
