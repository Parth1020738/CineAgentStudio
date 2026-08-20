import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    logline: '',
    tone: '',
    targetBudget: ''
  });

  const [statuses, setStatuses] = useState({
    adkInitialized: false,
    geminiConnected: false,
    storyAgentRunning: false,
    storyAgentCompleted: false,
    mcpConnected: false,
    runQueryAvailable: false,
    clickhouseQueryCompleted: false
  });

  const [storyResult, setStoryResult] = useState(null);
  const [mcpResult, setMcpResult] = useState(null);
  const [analyticsResult, setAnalyticsResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Perform initial system health checks
    fetch('http://localhost:3001/api/agent/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'healthy' || data.details?.googleAdkInitialized) {
          setStatuses((prev) => ({
            ...prev,
            adkInitialized: true,
            geminiConnected: Boolean(data.details?.geminiConnected)
          }));
        }
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/mcp/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'connected') {
          const tools = data.details?.tools || [];
          setStatuses((prev) => ({
            ...prev,
            mcpConnected: true,
            runQueryAvailable: tools.includes('run_query')
          }));
          setMcpResult(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTestStoryAgent = async () => {
    setLoading(true);
    setStatuses((prev) => ({
      ...prev,
      storyAgentRunning: true,
      storyAgentCompleted: false
    }));

    try {
      const response = await fetch('http://localhost:3001/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const resData = await response.json();

      if (response.ok) {
        setStoryResult(resData.data);
        setStatuses((prev) => ({
          ...prev,
          adkInitialized: true,
          geminiConnected: true,
          storyAgentRunning: false,
          storyAgentCompleted: true,
          clickhouseQueryCompleted: Boolean(resData.data?.telemetry?.mcpLogged)
        }));
      } else {
        alert(resData.error || 'Failed to trigger agent.');
        setStatuses((prev) => ({ ...prev, storyAgentRunning: false }));
      }
    } catch (err) {
      alert('Network error connecting to backend.');
      setStatuses((prev) => ({ ...prev, storyAgentRunning: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleTestClickHouseMcp = async () => {
    setStatuses((prev) => ({ ...prev, mcpConnected: false, runQueryAvailable: false, clickhouseQueryCompleted: false }));
    try {
      const response = await fetch('http://localhost:3001/api/mcp/health');
      const resData = await response.json();

      setMcpResult(resData);
      if (resData.status === 'connected') {
        const tools = resData.details?.tools || [];
        setStatuses((prev) => ({
          ...prev,
          mcpConnected: true,
          runQueryAvailable: tools.includes('run_query'),
          clickhouseQueryCompleted: true
        }));
      } else {
        alert(`MCP Test details: ${resData.details?.reason || resData.details?.error || 'unreachable'}`);
      }
    } catch (err) {
      alert('Network error checking MCP health.');
    }
  };

  const handleFetchAnalytics = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/mcp/analytics');
      const resData = await response.json();
      if (response.ok) {
        setAnalyticsResult(resData);
      } else {
        alert(resData.error || 'Failed to fetch analytics.');
      }
    } catch (err) {
      alert('Network error fetching analytics.');
    }
  };

  return (
    <div className="App">
      <header className="studio-header">
        <h1>CineAgent Studio</h1>
        <p className="subtitle">AI Film Pre-Production Studio Platform — Phase 2 ClickHouse MCP Runtime</p>
      </header>

      <div className="container">
        <section className="form-section">
          <h2>Film Concept Intake</h2>
          <div className="form-group">
            <label>Title</label>
            <input name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Neon Horizon" />
          </div>
          <div className="form-group">
            <label>Genre</label>
            <input name="genre" value={formData.genre} onChange={handleInputChange} placeholder="e.g. Sci-Fi Cyberpunk" />
          </div>
          <div className="form-group">
            <label>Logline Idea</label>
            <textarea name="logline" value={formData.logline} onChange={handleInputChange} placeholder="Brief concept idea..." />
          </div>
          <div className="form-group">
            <label>Tone</label>
            <input name="tone" value={formData.tone} onChange={handleInputChange} placeholder="e.g. Gritty, Neo-noir" />
          </div>
          <div className="form-group">
            <label>Target Budget ($)</label>
            <input name="targetBudget" value={formData.targetBudget} onChange={handleInputChange} placeholder="e.g. 5000000" />
          </div>

          <div className="button-group">
            <button onClick={handleTestStoryAgent} disabled={loading || !formData.title || !formData.genre || !formData.logline}>
              {loading ? 'Running Agent...' : 'Generate Story'}
            </button>
            <button onClick={handleTestClickHouseMcp}>
              Verify ClickHouse MCP
            </button>
            <button onClick={handleFetchAnalytics}>
              Fetch MCP Analytics
            </button>
          </div>
        </section>

        <section className="status-section">
          <h2>System Telemetry & Runtime Status</h2>
          <ul className="status-list">
            <li className={statuses.adkInitialized ? 'status-ok' : 'status-pending'}>
              {statuses.adkInitialized ? '✓ Google ADK Initialized' : '○ Google ADK Pending'}
            </li>
            <li className={statuses.geminiConnected ? 'status-ok' : 'status-pending'}>
              {statuses.geminiConnected ? '✓ Gemini Connected' : '○ Gemini Connection Pending'}
            </li>
            <li className={statuses.storyAgentRunning ? 'status-active' : statuses.storyAgentCompleted ? 'status-ok' : 'status-pending'}>
              {statuses.storyAgentRunning ? '⚡ Story Agent Generating...' : statuses.storyAgentCompleted ? '✓ Story Agent Completed' : '○ Story Agent Idle'}
            </li>
            <li className={statuses.mcpConnected ? 'status-ok' : 'status-pending'}>
              {statuses.mcpConnected ? '✓ ClickHouse MCP Server Connected (mcp-clickhouse stdio)' : '○ ClickHouse MCP Pending'}
            </li>
            <li className={statuses.runQueryAvailable ? 'status-ok' : 'status-pending'}>
              {statuses.runQueryAvailable ? '✓ MCP Tool Discovered: run_query' : '○ run_query Tool Pending'}
            </li>
            <li className={statuses.clickhouseQueryCompleted ? 'status-ok' : 'status-pending'}>
              {statuses.clickhouseQueryCompleted ? '✓ ClickHouse Cloud Query Executed via MCP' : '○ ClickHouse Query Idle'}
            </li>
          </ul>

          {storyResult && (
            <div className="result-card">
              <h3>Story Agent Package Output</h3>
              <p><strong>Logline:</strong> {storyResult.logline}</p>
              <p><strong>Synopsis:</strong> {storyResult.synopsis}</p>
              <h4>3-Act Structure</h4>
              <p><strong>Act I:</strong> {storyResult.three_act_structure?.act1}</p>
              <p><strong>Act II:</strong> {storyResult.three_act_structure?.act2}</p>
              <p><strong>Act III:</strong> {storyResult.three_act_structure?.act3}</p>
              {storyResult.telemetry && (
                <div className="telemetry-box">
                  <p><small><strong>Run ID:</strong> {storyResult.telemetry.runId}</small></p>
                  <p><small><strong>Duration:</strong> {storyResult.telemetry.durationMs}ms</small></p>
                  <p><small><strong>ClickHouse MCP Logged:</strong> {storyResult.telemetry.mcpLogged ? 'Yes' : 'No'}</small></p>
                </div>
              )}
            </div>
          )}

          {mcpResult && (
            <div className="result-card">
              <h3>MCP Connection & Tool Discovery Result</h3>
              <pre>{JSON.stringify(mcpResult, null, 2)}</pre>
            </div>
          )}

          {analyticsResult && (
            <div className="result-card">
              <h3>ClickHouse Cloud Agent Run Analytics (via MCP run_query)</h3>
              <pre>{JSON.stringify(analyticsResult, null, 2)}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
