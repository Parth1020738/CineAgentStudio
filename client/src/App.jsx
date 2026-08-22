import React, { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [formData, setFormData] = useState({
    title: 'Neon Horizon',
    genre: 'Sci-Fi Cyberpunk',
    logline: 'A rogue AI hunted by its creator uncovers a city-wide conspiracy.',
    tone: 'Neo-Noir, Gritty',
    targetBudget: '5000000',
    projectId: ''
  });

  const [pipelineState, setPipelineState] = useState({
    loading: false,
    stage: 'idle', // 'idle' | 'preparing' | 'story_agent' | 'screenplay_agent' | 'validating' | 'telemetry' | 'complete' | 'error'
    progressPct: 0,
    statusText: '',
    errorMsg: null
  });

  const [resultData, setResultData] = useState({
    projectId: null,
    storyPackage: null,
    screenplay: null,
    pipelineTelemetry: null
  });

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

  const handleGeneratePipeline = async (e) => {
    e.preventDefault();

    // Form Validation
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
      stage: 'preparing',
      progressPct: 15,
      statusText: '1. Preparing film concept intake payload...',
      errorMsg: null
    });
    setResultData({ projectId: null, storyPackage: null, screenplay: null, pipelineTelemetry: null });

    // Progress updates to give visual feedback during multi-agent execution
    const t1 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'story_agent',
        progressPct: 35,
        statusText: '2. Story Agent executing via Google ADK & Gemini...'
      }));
    }, 1200);

    const t2 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'screenplay_agent',
        progressPct: 65,
        statusText: '3. Story mapped to Screenplay Agent contract...'
      }));
    }, 15000);

    const t3 = setTimeout(() => {
      setPipelineState((prev) => ({
        ...prev,
        stage: 'validating',
        progressPct: 85,
        statusText: '4. Validating screenplay quality & narrative continuity...'
      }));
    }, 28000);

    try {
      const response = await fetch('/api/pipeline/story-to-screenplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || resData.message || 'Pipeline execution failed.');
      }

      setPipelineState({
        loading: false,
        stage: 'complete',
        progressPct: 100,
        statusText: '5. Pipeline completed & telemetry recorded to ClickHouse Cloud via MCP!',
        errorMsg: null
      });

      setResultData({
        projectId: resData.data.projectId,
        storyPackage: resData.data.storyPackage,
        screenplay: resData.data.screenplay,
        pipelineTelemetry: resData.data.pipelineTelemetry
      });
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setPipelineState({
        loading: false,
        stage: 'error',
        progressPct: 0,
        statusText: '',
        errorMsg: err.message || 'Network error connecting to CineAgent Studio gateway.'
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
            <p className="tagline">Autonomous Multi-Agent AI Film Pre-Production Platform</p>
          </div>
        </div>

        <div className="health-bar">
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
            <span className="badge">Production Setup</span>
          </div>

          <form onSubmit={handleGeneratePipeline} className="concept-form">
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

            <button
              type="submit"
              className="submit-btn"
              disabled={pipelineState.loading}
            >
              {pipelineState.loading ? (
                <>
                  <span className="spinner"></span> Executing Multi-Agent Pipeline...
                </>
              ) : (
                '🚀 Generate Production Draft (Story + Screenplay)'
              )}
            </button>
          </form>
        </section>

        {/* Pipeline Execution Progress */}
        {pipelineState.loading && (
          <section className="card progress-card">
            <h3>Pipeline Execution Status</h3>
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

        {/* Results Container */}
        {resultData.storyPackage && resultData.screenplay && (
          <div className="results-container">
            {/* Story Package Output */}
            <section className="card story-card">
              <div className="card-header">
                <h2>2. Story Agent Output</h2>
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

            {/* Formatted Screenplay Output */}
            <section className="card screenplay-card">
              <div className="card-header">
                <h2>3. Formatted Screenplay Output</h2>
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

            {/* Safe Telemetry & Production Analytics Panel */}
            {resultData.pipelineTelemetry && (
              <section className="card telemetry-card">
                <div className="card-header">
                  <h2>4. ClickHouse Telemetry Summary</h2>
                  <span className="badge telemetry-badge">ClickHouse Cloud via MCP</span>
                </div>

                <div className="telemetry-grid">
                  <div className="telemetry-item">
                    <span className="t-label">Pipeline Status</span>
                    <span className="t-val status-success">
                      {resultData.pipelineTelemetry.status}
                    </span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">Project ID</span>
                    <span className="t-val">{resultData.projectId}</span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">Story Agent Duration</span>
                    <span className="t-val">{resultData.storyPackage?.telemetry?.durationMs || 'N/A'} ms</span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">Screenplay Agent Duration</span>
                    <span className="t-val">{resultData.screenplay?.telemetry?.durationMs || 'N/A'} ms</span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">Total Pipeline Duration</span>
                    <span className="t-val">{resultData.pipelineTelemetry.durationMs} ms</span>
                  </div>

                  <div className="telemetry-item">
                    <span className="t-label">ClickHouse MCP Telemetry</span>
                    <span className="t-val status-success">
                      {resultData.pipelineTelemetry.mcpLogged ? 'PERSISTED ✅' : 'DISABLED'}
                    </span>
                  </div>
                </div>
                <p className="telemetry-note">
                  🔒 Telemetry execution metrics were securely logged to ClickHouse Cloud via standard MCP stdio protocol without exposing credentials.
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
