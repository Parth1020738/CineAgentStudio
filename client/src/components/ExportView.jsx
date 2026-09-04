import React, { useState } from 'react';

/**
 * Phase 5E - React Export Workspace & Download Component
 *
 * Consumes existing production plan data from React state.
 * Triggers binary blob downloads via POST /api/export without Gemini or ClickHouse dependencies.
 */
export default function ExportView({ productionPlan, isDemoData }) {
  const [downloadingType, setDownloadingType] = useState(null);
  const [statusState, setStatusState] = useState({
    type: 'idle', // 'idle' | 'loading' | 'success' | 'error'
    message: ''
  });

  if (!productionPlan) {
    return (
      <section className="card export-card" aria-label="Export Production Package">
        <div className="card-header">
          <h2>Export Production Package</h2>
        </div>
        <p className="no-data-msg">No active production plan available to export.</p>
      </section>
    );
  }

  // Extract compact project summary directly from existing production plan without recomputing
  const projectTitle = productionPlan.storyPackage?.title || productionPlan.screenplay?.title || 'Neon Horizon';
  const projectId = productionPlan.projectId || productionPlan.breakdown?.project_id || 'neon_horizon_001';
  const sceneCount = productionPlan.breakdown?.scenes?.length || productionPlan.screenplay?.scenes?.length || 0;
  const shootDays = productionPlan.schedule?.total_shoot_days || 0;
  const estimatedTotal = productionPlan.budget?.estimated_total || 0;
  const budgetStatus = productionPlan.budget?.status || 'UNDER_TARGET';

  /**
   * Shared download helper handling Blob streams from POST /api/export
   * Supports JSON, PDF, CSV, and ZIP binary formats.
   */
  const handleDownload = async (exportType, label) => {
    if (downloadingType) return;

    setDownloadingType(exportType);
    setStatusState({ type: 'loading', message: `Preparing ${label}...` });

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportType,
          productionPlan
        })
      });

      if (!response.ok) {
        let errMessage = 'Export server request failed.';
        try {
          const errJson = await response.json();
          errMessage = errJson.message || errJson.error || errMessage;
        } catch (e) {
          // ignore non-json error response
        }
        throw new Error(errMessage);
      }

      // Read Content-Disposition header for safe filename
      const disposition = response.headers.get('Content-Disposition') || '';
      let filename = `${exportType.toLowerCase()}`;
      const filenameMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      }

      // Convert response to Blob and trigger browser file download
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      setStatusState({ type: 'success', message: `Downloaded ${filename}` });
    } catch (err) {
      console.error(`[Export] ${exportType} failed:`, err.message);
      setStatusState({
        type: 'error',
        message: err.message || 'Failed to complete file export. Please try again.'
      });
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="export-workspace" aria-label="Export Workspace">
      {/* Header & Project Summary Card */}
      <section className="card export-header-card">
        <div className="card-header">
          <div>
            <h2>EXPORT PRODUCTION BIBLE</h2>
            <p className="section-subtitle">
              Download your screenplay, production breakdown, budget, shooting schedule, and production insights for sharing, review, or archival.
            </p>
          </div>
          <div className="header-badges">
            {isDemoData && (
              <span className="badge demo-badge" style={{ backgroundColor: '#78350f', color: '#fef3c7', fontWeight: 700 }}>
                LOCAL DEMO DATA
              </span>
            )}
            <span className="badge agent-badge">Ready for Export</span>
          </div>
        </div>

        {/* Compact Project Summary */}
        <div className="project-summary-bar" aria-label="Project Summary">
          <div className="summary-item">
            <span className="s-label">Project Title</span>
            <span className="s-val font-bold">{projectTitle}</span>
          </div>
          <div className="summary-item">
            <span className="s-label">Project ID</span>
            <span className="s-val code-val">{projectId}</span>
          </div>
          <div className="summary-item">
            <span className="s-label">Scenes</span>
            <span className="s-val">{sceneCount} Scenes</span>
          </div>
          <div className="summary-item">
            <span className="s-label">Shoot Days</span>
            <span className="s-val">{shootDays} Days</span>
          </div>
          <div className="summary-item">
            <span className="s-label">Estimated Budget</span>
            <span className="s-val">${estimatedTotal.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="s-label">Budget Status</span>
            <span className={`s-val status-pill ${budgetStatus === 'UNDER_TARGET' ? 'status-green' : 'status-yellow'}`}>
              {budgetStatus}
            </span>
          </div>
        </div>
      </section>

      {/* Accessible Live Status Banner */}
      <div className="status-aria-container" aria-live="polite">
        {statusState.type === 'loading' && (
          <div className="status-banner loading-banner" role="status">
            <span className="spinner"></span> {statusState.message}
          </div>
        )}
        {statusState.type === 'success' && (
          <div className="status-banner success-banner" role="status">
            ✅ {statusState.message}
          </div>
        )}
        {statusState.type === 'error' && (
          <div className="status-banner error-banner" role="alert">
            ⚠️ {statusState.message}
          </div>
        )}
      </div>

      {/* Dominant Production Bible CTA Card */}
      <section className="card production-bible-card">
        <div className="bible-card-content">
          <div className="bible-info">
            <div className="bible-title-row">
              <span className="bible-icon">📦</span>
              <div>
                <h3 className="bible-title">Production Bible</h3>
                <span className="bible-subtitle">Complete Project Archive (.ZIP)</span>
              </div>
            </div>
            <p className="bible-desc">
              Bundles all 12 canonical project assets into a single clean ZIP archive containing Screenplay, Breakdown, Budget, Shooting Schedule, and Production Insights in PDF, CSV, and JSON formats.
            </p>
            <div className="bible-includes">
              <span className="inc-tag">Screenplay PDF/JSON</span>
              <span className="inc-tag">Breakdown CSV/JSON</span>
              <span className="inc-tag">Budget PDF/CSV/JSON</span>
              <span className="inc-tag">Schedule PDF/CSV/JSON</span>
              <span className="inc-tag">Insights JSON</span>
            </div>
          </div>

          <div className="bible-action">
            <button
              type="button"
              className="submit-btn bible-btn"
              onClick={() => handleDownload('FULL_PRODUCTION_BIBLE_ZIP', 'Production Bible ZIP')}
              disabled={downloadingType !== null}
              aria-label="Download Complete Production Bible ZIP Archive"
            >
              {downloadingType === 'FULL_PRODUCTION_BIBLE_ZIP' ? (
                <>
                  <span className="spinner"></span> Preparing export...
                </>
              ) : (
                <>
                  📥 EXPORT PRODUCTION BIBLE
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Format Grouping Section Header */}
      <div style={{ marginTop: '32px', marginBottom: '16px' }}>
        <h3 style={{ color: '#f3f4f6', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
          EXPORT BY CATEGORY & FORMAT
        </h3>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
          Select specific document, spreadsheet, or JSON data payloads for individual department pipelines.
        </p>
      </div>

      {/* Group 2: Documents (PDF Format) */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: '#60a5fa', fontSize: '0.95rem', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
          Documents (PDF Format)
        </h4>
        <div className="export-cards-grid">
          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📜</span>
              <h4>Screenplay Document</h4>
            </div>
            <p className="item-desc">Formatted screenplay PDF formatted for table reads.</p>
            <button
              type="button"
              className="format-btn pdf-btn"
              onClick={() => handleDownload('SCREENPLAY_PDF', 'Screenplay PDF')}
              disabled={downloadingType !== null}
              aria-label="Download Screenplay PDF"
            >
              {downloadingType === 'SCREENPLAY_PDF' ? 'Preparing...' : '📄 Download Screenplay PDF'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">💰</span>
              <h4>Budget Document</h4>
            </div>
            <p className="item-desc">Full line-item budget breakdown PDF with reconciliation notes.</p>
            <button
              type="button"
              className="format-btn pdf-btn"
              onClick={() => handleDownload('BUDGET_PDF', 'Budget PDF')}
              disabled={downloadingType !== null}
              aria-label="Download Budget PDF"
            >
              {downloadingType === 'BUDGET_PDF' ? 'Preparing...' : '📄 Download Budget PDF'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📅</span>
              <h4>Schedule Document</h4>
            </div>
            <p className="item-desc">Day-by-day shooting stripboard schedule PDF.</p>
            <button
              type="button"
              className="format-btn pdf-btn"
              onClick={() => handleDownload('SCHEDULE_PDF', 'Schedule PDF')}
              disabled={downloadingType !== null}
              aria-label="Download Schedule PDF"
            >
              {downloadingType === 'SCHEDULE_PDF' ? 'Preparing...' : '📄 Download Schedule PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Group 3: Spreadsheets (CSV / Excel Format) */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: '#10b981', fontSize: '0.95rem', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
          Spreadsheets (CSV / Excel Format)
        </h4>
        <div className="export-cards-grid">
          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📋</span>
              <h4>Breakdown Spreadsheet</h4>
            </div>
            <p className="item-desc">Scene-by-scene breakdown elements sheet in CSV format.</p>
            <button
              type="button"
              className="format-btn csv-btn"
              onClick={() => handleDownload('BREAKDOWN_CSV', 'Breakdown CSV')}
              disabled={downloadingType !== null}
              aria-label="Download Breakdown CSV"
            >
              {downloadingType === 'BREAKDOWN_CSV' ? 'Preparing...' : '📊 Download Breakdown CSV'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">💰</span>
              <h4>Budget Spreadsheet</h4>
            </div>
            <p className="item-desc">Category & scene budget calculations sheet in Excel CSV format.</p>
            <button
              type="button"
              className="format-btn xlsx-btn"
              onClick={() => handleDownload('BUDGET_XLSX', 'Budget Spreadsheet CSV')}
              disabled={downloadingType !== null}
              aria-label="Download Budget Spreadsheet CSV"
            >
              {downloadingType === 'BUDGET_XLSX' ? 'Preparing...' : '📊 Download Budget CSV'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📅</span>
              <h4>Schedule Spreadsheet</h4>
            </div>
            <p className="item-desc">Day-by-day shoot roster and scene allocation sheet in CSV format.</p>
            <button
              type="button"
              className="format-btn xlsx-btn"
              onClick={() => handleDownload('SCHEDULE_XLSX', 'Schedule Spreadsheet CSV')}
              disabled={downloadingType !== null}
              aria-label="Download Schedule Spreadsheet CSV"
            >
              {downloadingType === 'SCHEDULE_XLSX' ? 'Preparing...' : '📊 Download Schedule CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Group 4: JSON Data (Raw Payloads) */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: '#fbbf24', fontSize: '0.95rem', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
          JSON Data (Raw Payloads)
        </h4>
        <div className="export-cards-grid">
          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📜</span>
              <h4>Screenplay JSON</h4>
            </div>
            <p className="item-desc">Structured scene & dialogue schema.</p>
            <button
              type="button"
              className="format-btn json-btn"
              onClick={() => handleDownload('SCREENPLAY', 'Screenplay JSON')}
              disabled={downloadingType !== null}
              aria-label="Download Screenplay JSON"
            >
              {downloadingType === 'SCREENPLAY' ? 'Preparing...' : '{ } Screenplay JSON'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📋</span>
              <h4>Breakdown JSON</h4>
            </div>
            <p className="item-desc">Structured scene breakdown schema.</p>
            <button
              type="button"
              className="format-btn json-btn"
              onClick={() => handleDownload('BREAKDOWN', 'Breakdown JSON')}
              disabled={downloadingType !== null}
              aria-label="Download Breakdown JSON"
            >
              {downloadingType === 'BREAKDOWN' ? 'Preparing...' : '{ } Breakdown JSON'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">💰</span>
              <h4>Budget JSON</h4>
            </div>
            <p className="item-desc">Structured financial & category model.</p>
            <button
              type="button"
              className="format-btn json-btn"
              onClick={() => handleDownload('BUDGET', 'Budget JSON')}
              disabled={downloadingType !== null}
              aria-label="Download Budget JSON"
            >
              {downloadingType === 'BUDGET' ? 'Preparing...' : '{ } Budget JSON'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📅</span>
              <h4>Schedule JSON</h4>
            </div>
            <p className="item-desc">Structured shoot timeline model.</p>
            <button
              type="button"
              className="format-btn json-btn"
              onClick={() => handleDownload('SCHEDULE', 'Schedule JSON')}
              disabled={downloadingType !== null}
              aria-label="Download Schedule JSON"
            >
              {downloadingType === 'SCHEDULE' ? 'Preparing...' : '{ } Schedule JSON'}
            </button>
          </div>

          <div className="card export-item-card">
            <div className="export-card-header">
              <span className="item-icon">📊</span>
              <h4>Insights JSON</h4>
            </div>
            <p className="item-desc">ClickHouse production metrics dataset.</p>
            <button
              type="button"
              className="format-btn json-btn"
              onClick={() => handleDownload('INSIGHTS', 'Insights JSON')}
              disabled={downloadingType !== null}
              aria-label="Download Production Insights JSON"
            >
              {downloadingType === 'INSIGHTS' ? 'Preparing...' : '{ } Insights JSON'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
