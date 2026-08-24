import React, { useState, useEffect } from 'react';
import './App.css';
import BreakdownView from './components/BreakdownView.jsx';
import BudgetView from './components/BudgetView.jsx';
import ScheduleView from './components/ScheduleView.jsx';
import ProductionInsightsView from './components/ProductionInsightsView.jsx';

export default function App() {
  const [formData, setFormData] = useState({
    title: 'Neon Horizon',
    genre: 'Sci-Fi Cyberpunk',
    logline: 'A rogue AI hunted by its creator uncovers a city-wide conspiracy.',
    tone: 'Neo-Noir, Gritty',
    targetBudget: '5000000',
    targetShootDays: '3',
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

  // Navigation tab states
  const [mainTab, setMainTab] = useState('story'); // 'story' | 'screenplay' | 'production_planning'
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

      // Default to Production Planning tab for immediate visual feedback
      setMainTab('production_planning');
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

      setMainTab('story');
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

  return (
    <div className="app-container">
      {/* Studio Header */}
      <header className="studio-header">
        <div className="header-brand">
          <div className="clapper-icon">🎬</div>
          <div>
            <h1>CINEAGENT STUDIO</h1>
            <p className="tagline">Autonomous Multi-Agent AI Film Pre-Production & Planning Platform</p>
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

      <main className="main-content">
        {/* Film Concept Intake Panel */}
        <section className="card form-card">
          <div className="card-header">
            <h2>1. Film Concept Intake</h2>
            <span className="badge">Studio Production Desk</span>
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
                  '🚀 Generate Full Production Plan (Breakdown + Budget + Schedule)'
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

        {/* Pipeline Execution Progress */}
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

        {/* Error Notification */}
        {pipelineState.stage === 'error' && (
          <div className="card error-card">
            <h3>⚠️ Pipeline Execution Error</h3>
            <p>{pipelineState.errorMsg}</p>
          </div>
        )}

        {/* Results Container with Primary Tabs */}
        {resultData.storyPackage && (
          <div className="results-container">
            {/* Top Workspace Navigation Tabs */}
            <div className="workspace-nav-bar">
              <div className="nav-tabs">
                <button
                  type="button"
                  className={`nav-tab ${mainTab === 'story' ? 'active' : ''}`}
                  onClick={() => setMainTab('story')}
                >
                  <span className="tab-icon">📖</span> Story Package
                </button>
                <button
                  type="button"
                  className={`nav-tab ${mainTab === 'screenplay' ? 'active' : ''}`}
                  onClick={() => setMainTab('screenplay')}
                >
                  <span className="tab-icon">📜</span> Screenplay
                </button>
                {resultData.breakdown && (
                  <button
                    type="button"
                    className={`nav-tab ${mainTab === 'production_planning' ? 'active' : ''}`}
                    onClick={() => setMainTab('production_planning')}
                  >
                    <span className="tab-icon">🎬</span> Production Planning
                    <span className="tab-pill">4 Views</span>
                  </button>
                )}
              </div>

              <div className="project-id-indicator">
                <span>Project: <strong>{resultData.projectId}</strong></span>
              </div>
            </div>

            {/* TAB 1: Story Package Output */}
            {mainTab === 'story' && (
              <section className="card story-card">
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

            {/* TAB 2: Screenplay Output */}
            {mainTab === 'screenplay' && resultData.screenplay && (
              <section className="card screenplay-card">
                <div className="card-header">
                  <h2>Formatted Screenplay Output</h2>
                  <span className="badge screenplay-badge">Screenplay Agent (Gemini)</span>
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

            {/* TAB 3: Production Planning Workspace */}
            {mainTab === 'production_planning' && (
              <div className="production-planning-container">
                {/* Planning Sub-Navigation Bar */}
                <div className="planning-subnav">
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
                    💰 Budget Intelligence
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${planningSubTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setPlanningSubTab('schedule')}
                  >
                    📅 Shooting Schedule ({resultData.schedule?.total_shoot_days || 0} Days)
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${planningSubTab === 'insights' ? 'active' : ''}`}
                    onClick={() => setPlanningSubTab('insights')}
                  >
                    📊 Production Insights
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

                {/* Sub-View 4: Insights (ClickHouse MCP) */}
                {planningSubTab === 'insights' && (
                  <ProductionInsightsView
                    insights={resultData.productionInsights}
                    projectId={resultData.projectId}
                  />
                )}
              </div>
            )}

            {/* Pipeline Telemetry Footer */}
            {resultData.pipelineTelemetry && (
              <section className="card telemetry-card">
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
                    <span className="t-val">{resultData.pipelineTelemetry.durationMs || 0} ms</span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">ClickHouse MCP Telemetry</span>
                    <span className="t-val status-success">
                      {resultData.pipelineTelemetry.mcpLogged ? 'PERSISTED ✅' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
