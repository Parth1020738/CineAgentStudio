import React, { useState } from 'react';

export default function BreakdownView({ breakdown }) {
  const [filter, setFilter] = useState('ALL');

  if (!breakdown || !breakdown.scenes || breakdown.scenes.length === 0) {
    return (
      <div className="card empty-state-card">
        <p>No production breakdown data available.</p>
      </div>
    );
  }

  const scenes = breakdown.scenes || [];

  const highCostCount = scenes.filter(s => (s.estimated_cost || 0) >= 30000).length;
  const highComplexityCount = scenes.filter(s => s.complexity === 'HIGH').length;
  const locationsList = Array.from(new Set(scenes.map(s => s.location).filter(Boolean)));
  const castList = Array.from(new Set(scenes.flatMap(s => s.cast || [])));
  const totalElementsCount = scenes.reduce((acc, s) => {
    const propsCount = (s.props || []).length;
    const vfxCount = (s.vfx || []).length;
    const eqCount = (s.special_equipment || []).length;
    return acc + propsCount + vfxCount + eqCount;
  }, 0);

  const filteredScenes = scenes.filter((scene) => {
    if (filter === 'HIGH_COST') {
      return (scene.estimated_cost || 0) >= 30000;
    }
    if (filter === 'HIGH_COMPLEXITY') {
      return scene.complexity === 'HIGH';
    }
    if (filter === 'NIGHT') {
      return (scene.time_of_day || '').toUpperCase() === 'NIGHT';
    }
    if (filter === 'EXTERIOR') {
      return (scene.interior_exterior || '').toUpperCase() === 'EXT';
    }
    return true;
  });

  const formatCurrency = (val) => {
    if (typeof val !== 'number') return '$0';
    return '$' + val.toLocaleString();
  };

  return (
    <div className="breakdown-workspace">
      {/* Summary Highlights */}
      <div className="breakdown-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scenes</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#f3f4f6', marginTop: '4px' }}>{scenes.length}</div>
        </div>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High Cost Scenes</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>{highCostCount}</div>
        </div>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High Complexity</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#fbbf24', marginTop: '4px' }}>{highComplexityCount}</div>
        </div>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locations</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#60a5fa', marginTop: '4px' }}>{locationsList.length}</div>
        </div>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cast Members</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>{castList.length}</div>
        </div>
        <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', border: '1px solid #374151' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Production Elements</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#e5b869', marginTop: '4px' }}>{totalElementsCount}</div>
        </div>
      </div>

      {/* Header & Filter Controls */}
      <div className="breakdown-header-bar">
        <div>
          <h3>Scene-by-Scene Production Breakdown</h3>
          <p className="section-subtitle">
            Asset requirements, department dependencies, and technical complexity per scene.
          </p>
        </div>

        <div className="filter-chips">
          <button
            type="button"
            className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All ({scenes.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'HIGH_COST' ? 'active' : ''}`}
            onClick={() => setFilter('HIGH_COST')}
          >
            High Cost (&ge; $30k)
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'HIGH_COMPLEXITY' ? 'active' : ''}`}
            onClick={() => setFilter('HIGH_COMPLEXITY')}
          >
            High Complexity
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'NIGHT' ? 'active' : ''}`}
            onClick={() => setFilter('NIGHT')}
          >
            Night
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === 'EXTERIOR' ? 'active' : ''}`}
            onClick={() => setFilter('EXTERIOR')}
          >
            Exterior
          </button>
        </div>
      </div>

      {/* Scene Breakdown Cards Grid */}
      <div className="breakdown-grid">
        {filteredScenes.map((scene) => {
          const complexityClass =
            scene.complexity === 'HIGH'
              ? 'badge-high'
              : scene.complexity === 'MEDIUM'
              ? 'badge-medium'
              : 'badge-low';

          return (
            <div key={scene.scene_number} className="breakdown-card">
              {/* Scene Card Header */}
              <div className="breakdown-card-top">
                <div className="scene-title-group">
                  <span className="scene-num-badge">SCENE {String(scene.scene_number).padStart(2, '0')}</span>
                  <h4 className="scene-heading-title">{scene.scene_heading}</h4>
                </div>
                <div className="scene-top-badges">
                  <span className={`complexity-badge ${complexityClass}`}>
                    {scene.complexity} COMPLEXITY
                  </span>
                  <span className="cost-tag">{formatCurrency(scene.estimated_cost)}</span>
                </div>
              </div>

              {/* Location & Time Subheader */}
              <div className="scene-meta-strip">
                <div className="meta-pill">
                  <span className="meta-label">Location:</span>
                  <span className="meta-value">{scene.location}</span>
                </div>
                <div className="meta-pill">
                  <span className="meta-label">Setting:</span>
                  <span className="meta-value">{scene.interior_exterior}</span>
                </div>
                <div className="meta-pill">
                  <span className="meta-label">Time of Day:</span>
                  <span className="meta-value">{scene.time_of_day}</span>
                </div>
              </div>

              {/* Department Asset Breakdown */}
              <div className="breakdown-sections-grid">
                {/* Cast & Extras */}
                <div className="dept-block">
                  <span className="dept-title">Cast & Talent</span>
                  <div className="tag-list">
                    {scene.characters && scene.characters.length > 0 ? (
                      scene.characters.map((c, i) => <span key={i} className="asset-tag char-tag">{c}</span>)
                    ) : (
                      <span className="none-text">None</span>
                    )}
                    {scene.extras_count > 0 && (
                      <span className="asset-tag extras-tag">{scene.extras_count} Extras</span>
                    )}
                  </div>
                </div>

                {/* Props */}
                <div className="dept-block">
                  <span className="dept-title">Props</span>
                  <div className="tag-list">
                    {scene.props && scene.props.length > 0 ? (
                      scene.props.map((p, i) => <span key={i} className="asset-tag">{p}</span>)
                    ) : (
                      <span className="none-text">None</span>
                    )}
                  </div>
                </div>

                {/* Special Equipment */}
                <div className="dept-block">
                  <span className="dept-title">Special Equipment</span>
                  <div className="tag-list">
                    {scene.special_equipment && scene.special_equipment.length > 0 ? (
                      scene.special_equipment.map((eq, i) => <span key={i} className="asset-tag equip-tag">{eq}</span>)
                    ) : (
                      <span className="none-text">Standard Package</span>
                    )}
                  </div>
                </div>

                {/* Visual Effects & SFX */}
                <div className="dept-block">
                  <span className="dept-title">VFX & Practical SFX</span>
                  <div className="tag-list">
                    {scene.vfx && scene.vfx.length > 0 && (
                      scene.vfx.map((v, i) => <span key={`vfx-${i}`} className="asset-tag vfx-tag">VFX: {v}</span>)
                    )}
                    {scene.special_effects && scene.special_effects.length > 0 && (
                      scene.special_effects.map((s, i) => <span key={`sfx-${i}`} className="asset-tag sfx-tag">SFX: {s}</span>)
                    )}
                    {(!scene.vfx || scene.vfx.length === 0) && (!scene.special_effects || scene.special_effects.length === 0) && (
                      <span className="none-text">None</span>
                    )}
                  </div>
                </div>

                {/* Wardrobe & Makeup */}
                <div className="dept-block">
                  <span className="dept-title">Wardrobe & Makeup</span>
                  <div className="tag-list">
                    {scene.wardrobe && scene.wardrobe.length > 0 && (
                      scene.wardrobe.map((w, i) => <span key={`w-${i}`} className="asset-tag">{w}</span>)
                    )}
                    {scene.makeup_effects && scene.makeup_effects.length > 0 && (
                      scene.makeup_effects.map((m, i) => <span key={`m-${i}`} className="asset-tag">{m}</span>)
                    )}
                    {(!scene.wardrobe || scene.wardrobe.length === 0) && (!scene.makeup_effects || scene.makeup_effects.length === 0) && (
                      <span className="none-text">Standard</span>
                    )}
                  </div>
                </div>

                {/* Vehicles */}
                <div className="dept-block">
                  <span className="dept-title">Vehicles</span>
                  <div className="tag-list">
                    {scene.vehicles && scene.vehicles.length > 0 ? (
                      scene.vehicles.map((vh, i) => <span key={i} className="asset-tag">{vh}</span>)
                    ) : (
                      <span className="none-text">None</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Production Notes */}
              {scene.production_notes && (
                <div className="production-notes-box">
                  <span className="notes-label">Production Notes:</span>
                  <p>{scene.production_notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
