import React, { useState } from 'react';

export function ScriptDoctorView({ screenplay }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'reviewing' | 'success' | 'error'
  const [analysis, setAnalysis] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleReviewScript = async () => {
    if (!screenplay) {
      setErrorMsg('No active screenplay found to review.');
      setStatus('error');
      return;
    }

    setStatus('reviewing');
    setErrorMsg('');

    try {
      const response = await fetch('/api/script-doctor/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenplay })
      });

      const resData = await response.json();

      if (!response.ok || resData.status !== 'success') {
        throw new Error(resData.error || 'Script Doctor review failed.');
      }

      setAnalysis(resData.data);
      setStatus('success');
    } catch (err) {
      console.error('[Script Doctor UI Error]:', err);
      setErrorMsg(err.message || 'Failed to complete Script Doctor review.');
      setStatus('error');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 85) return '#10b981'; // Green
    if (score >= 70) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const categoryLabels = {
    structure: 'Structure',
    pacing: 'Pacing',
    character_arcs: 'Character Arcs',
    dialogue: 'Dialogue',
    conflict: 'Conflict & Stakes',
    scene_effectiveness: 'Scene Effectiveness',
    production_feasibility: 'Production Feasibility'
  };

  return (
    <div className="script-doctor-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="script-doctor-header" style={{ marginBottom: '24px', borderBottom: '1px solid #374151', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f3f4f6', margin: '0 0 8px 0' }}>
              SCRIPT DOCTOR
            </h2>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
              Get an AI editorial pass on your screenplay before committing to production.
            </p>
          </div>
          <button
            onClick={handleReviewScript}
            disabled={status === 'reviewing' || !screenplay}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '6px',
              cursor: status === 'reviewing' || !screenplay ? 'not-allowed' : 'pointer',
              opacity: status === 'reviewing' || !screenplay ? 0.6 : 1
            }}
          >
            {status === 'reviewing' ? 'Reviewing...' : 'Review My Script'}
          </button>
        </div>
      </div>

      {status === 'idle' && (
        <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#1f2937', borderRadius: '8px', border: '1px dashed #4b5563' }}>
          <h3 style={{ color: '#e5e7eb', marginBottom: '8px' }}>Ready for Editorial Assessment</h3>
          <p style={{ color: '#9ca3af', maxWidth: '600px', margin: '0 auto 20px auto', fontSize: '14px' }}>
            Click "Review My Script" above to run an in-depth story analysis evaluating pacing, character arcs, dialogue, conflict, and production feasibility.
          </p>
        </div>
      )}

      {status === 'reviewing' && (
        <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#1f2937', borderRadius: '8px' }}>
          <div className="spinner" style={{ marginBottom: '16px' }}>⚙️</div>
          <h3 style={{ color: '#e5e7eb', marginBottom: '8px' }}>Analyzing Screenplay...</h3>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>Evaluating scene structure, character subtext, conflict stakes, and production feasibility.</p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '16px', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', borderRadius: '8px', marginBottom: '24px' }}>
          <strong>Script Doctor Error:</strong> {errorMsg}
        </div>
      )}

      {status === 'success' && analysis && (
        <div className="script-doctor-results" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Overall Score Banner */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', borderLeft: `6px solid ${getScoreColor(analysis.overall_score)}` }}>
            <div style={{ marginRight: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: '800', color: getScoreColor(analysis.overall_score), lineHeight: 1 }}>
                {analysis.overall_score}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '1px' }}>
                Overall Score
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#f3f4f6', fontSize: '18px' }}>Editorial Verdict</h3>
              <p style={{ margin: 0, color: '#d1d5db', fontSize: '14px' }}>
                {analysis.overall_score >= 80
                  ? 'Strong cinematic foundation with high production potential and clear conflict stakes.'
                  : analysis.overall_score >= 70
                  ? 'Solid draft with compelling moments, requiring minor pacing and character refinements.'
                  : 'Requires structural and dialogue revisions before advancing to production breakdown.'}
              </p>
            </div>
          </div>

          {/* Category Scores Grid */}
          <div>
            <h3 style={{ color: '#e5e7eb', fontSize: '16px', marginBottom: '12px' }}>Category Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {Object.entries(analysis.category_scores).map(([catKey, score]) => (
                <div key={catKey} style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '6px', border: '1px solid #374151' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '500' }}>
                      {categoryLabels[catKey] || catKey}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: getScoreColor(score) }}>
                      {score}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${score}%`,
                        height: '100%',
                        backgroundColor: getScoreColor(score),
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Lists Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Strengths */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#10b981', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✓</span> STRENGTHS
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {analysis.strengths.map((str, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{str}</li>
                ))}
              </ul>
            </div>

            {/* Issues */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠</span> ISSUES FOUND
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {analysis.issues.map((iss, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{iss}</li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', border: '1px solid #374151' }}>
              <h4 style={{ color: '#3b82f6', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💡</span> RECOMMENDATIONS
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScriptDoctorView;
