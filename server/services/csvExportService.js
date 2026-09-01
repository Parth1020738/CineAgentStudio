import { sanitizeExportPayload } from './exportService.js';

function formatCsvCell(val) {
  if (val == null) return '""';
  if (Array.isArray(val)) val = val.join('; ');
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatCsvRow(fields) {
  return fields.map(formatCsvCell).join(',');
}

/**
 * Generates Breakdown CSV string from export package.
 * @param {object} exportPackage 
 * @returns {string} CSV content with UTF-8 BOM
 */
export function generateBreakdownCsv(exportPackage) {
  const cleanPkg = sanitizeExportPayload(exportPackage);
  const breakdown = cleanPkg.breakdown;
  if (!breakdown || !Array.isArray(breakdown.scenes)) {
    throw new Error('CSV Generation Error: Breakdown data is missing or invalid.');
  }

  const headers = [
    'scene_number',
    'scene_heading',
    'location',
    'interior_exterior',
    'time_of_day',
    'characters',
    'extras_count',
    'props',
    'vehicles',
    'wardrobe',
    'makeup_fx',
    'special_equipment',
    'special_effects',
    'vfx',
    'production_complexity',
    'estimated_cost',
    'production_notes'
  ];

  const rows = [formatCsvRow(headers)];

  breakdown.scenes.forEach(scene => {
    rows.push(formatCsvRow([
      scene.scene_number,
      scene.scene_heading,
      scene.location,
      scene.interior_exterior,
      scene.time_of_day,
      scene.characters,
      scene.extras_count,
      scene.props,
      scene.vehicles,
      scene.wardrobe,
      scene.makeup_fx,
      scene.special_equipment,
      scene.special_effects,
      scene.vfx,
      scene.production_complexity,
      scene.estimated_cost,
      scene.production_notes
    ]));
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generates Budget CSV string from export package.
 * @param {object} exportPackage 
 * @returns {string} CSV content with UTF-8 BOM
 */
export function generateBudgetCsv(exportPackage) {
  const cleanPkg = sanitizeExportPayload(exportPackage);
  const budget = cleanPkg.budget;
  if (!budget) {
    throw new Error('CSV Generation Error: Budget data is missing.');
  }

  const rows = [];

  // Overview Summary
  rows.push(formatCsvRow(['PROJECT BUDGET SUMMARY', '', '']));
  rows.push(formatCsvRow(['Project Title', budget.title || cleanPkg.metadata?.project_title || 'Untitled', '']));
  rows.push(formatCsvRow(['Target Budget', budget.target_budget || 0, '']));
  rows.push(formatCsvRow(['Estimated Total Cost', budget.estimated_total || 0, '']));
  rows.push(formatCsvRow(['Budget Status', budget.budget_status || 'AT_TARGET', '']));
  rows.push(formatCsvRow(['Target Variance', budget.target_variance || 0, '']));
  rows.push('');

  // Categories Breakdown
  rows.push(formatCsvRow(['BUDGET CATEGORIES', 'ESTIMATED COST', 'EXPLANATION']));
  if (Array.isArray(budget.categories)) {
    budget.categories.forEach(cat => {
      rows.push(formatCsvRow([cat.category, cat.estimated_cost, cat.explanation || '']));
    });
  }
  rows.push('');

  // Scene Costs Breakdown
  if (Array.isArray(budget.scene_costs)) {
    rows.push(formatCsvRow(['SCENE NUMBER', 'SCENE HEADING', 'ESTIMATED SCENE COST']));
    budget.scene_costs.forEach(sc => {
      rows.push(formatCsvRow([sc.scene_number, sc.scene_heading, sc.estimated_cost]));
    });
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generates Schedule CSV string from export package.
 * @param {object} exportPackage 
 * @returns {string} CSV content with UTF-8 BOM
 */
export function generateScheduleCsv(exportPackage) {
  const cleanPkg = sanitizeExportPayload(exportPackage);
  const schedule = cleanPkg.schedule;
  if (!schedule || !Array.isArray(schedule.days)) {
    throw new Error('CSV Generation Error: Schedule data is missing or invalid.');
  }

  const headers = [
    'shooting_day',
    'date_label',
    'location',
    'time_of_day',
    'scene_number',
    'cast',
    'extras_count',
    'estimated_day_cost',
    'setup_notes',
    'rationale',
    'risks'
  ];

  const rows = [formatCsvRow(headers)];

  schedule.days.forEach(day => {
    const scenes = Array.isArray(day.scenes) ? day.scenes : [];
    scenes.forEach(sceneNum => {
      rows.push(formatCsvRow([
        day.shooting_day,
        day.date_label || `Day ${day.shooting_day}`,
        day.location,
        day.time_of_day,
        sceneNum,
        day.cast,
        day.extras_count || 0,
        day.estimated_day_cost || 0,
        day.setup_notes || '',
        day.rationale || '',
        day.risks || []
      ]));
    });
  });

  return '\uFEFF' + rows.join('\r\n');
}
