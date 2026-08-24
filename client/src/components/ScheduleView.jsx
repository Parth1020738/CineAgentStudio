import React from 'react';

export default function ScheduleView({ schedule }) {
  if (!schedule || !schedule.days || schedule.days.length === 0) {
    return (
      <div className="card empty-state-card">
        <p>No production schedule data available.</p>
      </div>
    );
  }

  const formatCurrency = (val) => {
    if (typeof val !== 'number') return '$0';
    return '$' + val.toLocaleString();
  };

  const optimization = schedule.optimization_summary || {};
  const days = schedule.days || [];

  return (
    <div className="schedule-workspace">
      {/* Schedule Optimization Summary */}
      <div className="schedule-optimization-card">
        <div className="card-header-simple">
          <div>
            <h3>Production Schedule Optimization</h3>
            <p className="section-subtitle">
              Calculated location clustering, continuous night shoot blocks, and cast load balancing.
            </p>
          </div>
          <span className="badge-days">{schedule.total_shoot_days || days.length} Total Shoot Days</span>
        </div>

        <div className="optimization-stats-grid">
          <div className="opt-stat-box">
            <span className="opt-stat-val">{schedule.total_shoot_days || days.length}</span>
            <span className="opt-stat-label">Shoot Days</span>
          </div>
          <div className="opt-stat-box">
            <span className="opt-stat-val">{optimization.locations_consolidated || 0}</span>
            <span className="opt-stat-label">Locations Consolidated</span>
          </div>
          <div className="opt-stat-box">
            <span className="opt-stat-val">{optimization.night_blocks || 0}</span>
            <span className="opt-stat-label">Night Blocks</span>
          </div>
          <div className="opt-stat-box">
            <span className="opt-stat-val">{optimization.estimated_location_moves || 0}</span>
            <span className="opt-stat-label">Company Moves</span>
          </div>
        </div>

        {optimization.scheduling_notes && (
          <div className="opt-notes-callout">
            <strong>Optimization Strategy:</strong> {optimization.scheduling_notes}
          </div>
        )}
      </div>

      {/* Day-by-Day Shooting Schedule Grid */}
      <div className="days-timeline">
        {days.map((day) => (
          <div key={day.shooting_day} className="day-schedule-card">
            {/* Day Header */}
            <div className="day-card-top">
              <div className="day-title-group">
                <span className="day-number-badge">DAY {day.shooting_day}</span>
                <span className="day-date-label">{day.date_label || `Shoot Day ${day.shooting_day}`}</span>
              </div>
              <div className="day-top-meta">
                <span className={`time-badge ${day.time_of_day === 'NIGHT' ? 'badge-night' : 'badge-day'}`}>
                  {day.time_of_day}
                </span>
                <span className="day-cost-tag">{formatCurrency(day.estimated_day_cost)}</span>
              </div>
            </div>

            {/* Location & Scene Allocation */}
            <div className="day-location-strip">
              <div className="location-info">
                <span className="loc-icon">📍</span>
                <span className="loc-name">{day.location}</span>
              </div>
              <div className="scenes-allocated">
                <span className="scenes-label">Scenes Assigned:</span>
                <div className="scene-pills">
                  {day.scenes && day.scenes.map((sNum) => (
                    <span key={sNum} className="scene-pill">Scene {sNum}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cast & Talent Call Roster */}
            <div className="day-cast-roster">
              <span className="roster-label">Talent Call Roster:</span>
              <div className="roster-tags">
                {day.cast && day.cast.length > 0 ? (
                  day.cast.map((c, i) => <span key={i} className="cast-call-tag">{c}</span>)
                ) : (
                  <span className="none-text">No Principal Cast</span>
                )}
                {day.extras_count > 0 && (
                  <span className="extras-call-tag">{day.extras_count} Extras</span>
                )}
              </div>
            </div>

            {/* Setup Notes */}
            {day.setup_notes && (
              <div className="day-detail-block">
                <span className="detail-label">Rigging & Setup Notes:</span>
                <p className="detail-content">{day.setup_notes}</p>
              </div>
            )}

            {/* Production Rationale */}
            {day.rationale && (
              <div className="day-detail-block">
                <span className="detail-label">Production Rationale:</span>
                <p className="detail-content">{day.rationale}</p>
              </div>
            )}

            {/* Risk Assessment & Mitigations */}
            {day.risks && day.risks.length > 0 && (
              <div className="day-risks-block">
                <span className="detail-label">Identified Operational Risks:</span>
                <div className="risk-tags-list">
                  {day.risks.map((risk, rIdx) => (
                    <span key={rIdx} className="risk-tag">⚠️ {risk}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assumptions Footer */}
      {schedule.assumptions && schedule.assumptions.length > 0 && (
        <div className="schedule-assumptions-card">
          <h4>Scheduling Parameters & Assumptions</h4>
          <ul className="assumptions-list">
            {schedule.assumptions.map((asm, i) => (
              <li key={i}>{asm}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
