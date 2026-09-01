import { z } from 'zod';
import { StoryOutputSchema } from '../agents/storyAgent.js';
import { ScreenplayOutputSchema } from '../agents/screenplayAgent.js';
import { ProductionBreakdownSchema } from '../agents/breakdownAgent.js';
import { BudgetOutputSchema } from '../agents/budgetAgent.js';
import { ScheduleOutputSchema } from '../agents/scheduleAgent.js';
import { isDemoModeEnabled, getDemoProductionPlan } from '../fixtures/demoFixtures.js';

import { generateScreenplayPdf, generateBudgetPdf, generateSchedulePdf } from './pdfExportService.js';
import { generateBreakdownCsv, generateBudgetCsv, generateScheduleCsv } from './csvExportService.js';
import { generateProductionBibleZip } from './zipExportService.js';

export const EXPORT_TYPES = {
  FULL_PRODUCTION_PACKAGE: 'FULL_PRODUCTION_PACKAGE',
  SCREENPLAY: 'SCREENPLAY',
  BREAKDOWN: 'BREAKDOWN',
  BUDGET: 'BUDGET',
  SCHEDULE: 'SCHEDULE',
  INSIGHTS: 'INSIGHTS',
  SCREENPLAY_PDF: 'SCREENPLAY_PDF',
  BUDGET_PDF: 'BUDGET_PDF',
  SCHEDULE_PDF: 'SCHEDULE_PDF',
  BREAKDOWN_CSV: 'BREAKDOWN_CSV',
  BUDGET_CSV: 'BUDGET_CSV',
  SCHEDULE_CSV: 'SCHEDULE_CSV',
  BUDGET_XLSX: 'BUDGET_XLSX',
  SCHEDULE_XLSX: 'SCHEDULE_XLSX',
  FULL_PRODUCTION_BIBLE_ZIP: 'FULL_PRODUCTION_BIBLE_ZIP'
};

export const ExportTypeSchema = z.enum([
  'FULL_PRODUCTION_PACKAGE',
  'SCREENPLAY',
  'BREAKDOWN',
  'BUDGET',
  'SCHEDULE',
  'INSIGHTS',
  'SCREENPLAY_PDF',
  'BUDGET_PDF',
  'SCHEDULE_PDF',
  'BREAKDOWN_CSV',
  'BUDGET_CSV',
  'SCHEDULE_CSV',
  'BUDGET_XLSX',
  'SCHEDULE_XLSX',
  'FULL_PRODUCTION_BIBLE_ZIP'
]);

export const ExportMetadataSchema = z.object({
  export_id: z.string().min(1),
  project_id: z.string().min(1),
  project_title: z.string().min(1),
  export_type: ExportTypeSchema,
  generated_at: z.string().min(1),
  application_version: z.string().min(1),
  schema_version: z.string().min(1)
});

export const ProductionExportPackageSchema = z.object({
  metadata: ExportMetadataSchema,
  story: StoryOutputSchema.optional(),
  screenplay: ScreenplayOutputSchema.optional(),
  breakdown: ProductionBreakdownSchema.optional(),
  budget: BudgetOutputSchema.optional(),
  schedule: ScheduleOutputSchema.optional(),
  insights: z.record(z.any()).optional()
});

/**
 * Generates a safe, sanitized filename for production exports, preventing path traversal and illegal characters.
 * @param {string} title Project title or identifier
 * @param {string} exportType Supported export type
 * @returns {string} Sanitized filename string
 */
export function getSafeExportFilename(title, exportType) {
  const safeTitle = (title || 'project')
    .toString()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  const cleanSlug = safeTitle.length > 0 ? safeTitle : 'project';

  switch (exportType) {
    case EXPORT_TYPES.SCREENPLAY:
      return `${cleanSlug}-screenplay.json`;
    case EXPORT_TYPES.SCREENPLAY_PDF:
      return `${cleanSlug}-screenplay.pdf`;
    case EXPORT_TYPES.BREAKDOWN:
      return `${cleanSlug}-breakdown.json`;
    case EXPORT_TYPES.BREAKDOWN_CSV:
      return `${cleanSlug}-breakdown.csv`;
    case EXPORT_TYPES.BUDGET:
      return `${cleanSlug}-budget.json`;
    case EXPORT_TYPES.BUDGET_PDF:
      return `${cleanSlug}-budget.pdf`;
    case EXPORT_TYPES.BUDGET_CSV:
      return `${cleanSlug}-budget.csv`;
    case EXPORT_TYPES.BUDGET_XLSX:
      return `${cleanSlug}-budget.csv`;
    case EXPORT_TYPES.SCHEDULE:
      return `${cleanSlug}-schedule.json`;
    case EXPORT_TYPES.SCHEDULE_PDF:
      return `${cleanSlug}-schedule.pdf`;
    case EXPORT_TYPES.SCHEDULE_CSV:
      return `${cleanSlug}-schedule.csv`;
    case EXPORT_TYPES.SCHEDULE_XLSX:
      return `${cleanSlug}-schedule.csv`;
    case EXPORT_TYPES.INSIGHTS:
      return `${cleanSlug}-insights.json`;
    case EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP:
      return `${cleanSlug}-production-bible.zip`;
    case EXPORT_TYPES.FULL_PRODUCTION_PACKAGE:
    default:
      return `${cleanSlug}-production-package.json`;
  }
}

/**
 * Sanitizes credentials and sensitive key patterns from export data structures.
 * @param {any} data Input data structure
 * @returns {any} Clean sanitized structure
 */
export function sanitizeExportPayload(data) {
  if (data == null) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeExportPayload);

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('token')
    ) {
      continue;
    }
    clean[key] = sanitizeExportPayload(value);
  }
  return clean;
}

/**
 * Validates cross-component data fidelity across Screenplay, Breakdown, Budget, Schedule.
 * @param {object} components Component outputs container
 * @returns {boolean} True if fidelity checks pass, throws Error otherwise
 */
export function validateExportFidelity({ screenplay, breakdown, budget, schedule }) {
  // 1. Scene Count & Heading Matching
  if (screenplay && breakdown) {
    if (screenplay.scenes.length !== breakdown.scenes.length) {
      throw new Error(`Fidelity Mismatch: Screenplay scene count (${screenplay.scenes.length}) does not match Breakdown scene count (${breakdown.scenes.length}).`);
    }
    for (let i = 0; i < screenplay.scenes.length; i++) {
      if (screenplay.scenes[i].scene_number !== breakdown.scenes[i].scene_number) {
        throw new Error(`Fidelity Mismatch: Scene number mismatch at position ${i + 1}.`);
      }
    }
  }

  if (breakdown && schedule) {
    const breakdownSceneNums = new Set(breakdown.scenes.map(s => s.scene_number));
    const scheduledSceneNums = new Set();
    schedule.days.forEach(day => {
      day.scenes.forEach(s => scheduledSceneNums.add(s));
    });

    if (breakdownSceneNums.size !== scheduledSceneNums.size) {
      throw new Error(`Fidelity Mismatch: Breakdown scene count (${breakdownSceneNums.size}) does not match Schedule scheduled scenes count (${scheduledSceneNums.size}).`);
    }
    for (const num of breakdownSceneNums) {
      if (!scheduledSceneNums.has(num)) {
        throw new Error(`Fidelity Mismatch: Scene ${num} from breakdown is missing in Schedule.`);
      }
    }
  }

  // 2. Budget Financial Reconciliation
  if (budget) {
    if (typeof budget.estimated_total !== 'number' || isNaN(budget.estimated_total)) {
      throw new Error('Fidelity Mismatch: Budget estimated_total must be a valid number.');
    }
    if (budget.budget_reconciliation) {
      const { scene_linked_cost_total, project_wide_cost_total, contingency_cost, estimated_total } = budget.budget_reconciliation;
      const expectedTotal = (scene_linked_cost_total || 0) + (project_wide_cost_total || 0) + (contingency_cost || 0);
      if (Math.abs(expectedTotal - estimated_total) > 0.01) {
        throw new Error(`Fidelity Mismatch: Budget reconciliation sum mismatch (${expectedTotal} != ${estimated_total}).`);
      }
    }
  }

  return true;
}

/**
 * Constructs the canonical ProductionExportPackage derived from validated runtime data.
 * @param {object} options Options container (productionPlan, exportType, projectId, title)
 * @returns {object} Validated ProductionExportPackage object
 */
export function createExportPackage(arg1 = {}, arg2) {
  let exportType = EXPORT_TYPES.FULL_PRODUCTION_PACKAGE;
  let plan = null;
  let options = {};

  if (arg1 && typeof arg1 === 'object') {
    if ('productionPlan' in arg1 || 'exportType' in arg1) {
      options = arg1;
      plan = arg1.productionPlan;
      exportType = arg1.exportType || exportType;
    } else {
      plan = arg1;
      if (typeof arg2 === 'string') {
        exportType = arg2;
      }
    }
  } else if (typeof arg1 === 'string') {
    exportType = arg1;
  }

  exportType = ExportTypeSchema.parse(exportType);

  if (!plan) {
    if (isDemoModeEnabled()) {
      plan = getDemoProductionPlan(options);
    } else {
      throw new Error('Export creation failed: Valid production plan data must be provided.');
    }
  }

  const story = plan.storyPackage || plan.story;
  const screenplay = plan.screenplay;
  const breakdown = plan.breakdown;
  const budget = plan.budget;
  const schedule = plan.schedule;
  const insights = plan.insights || plan.productionInsights;

  const projectId = options.projectId || plan.project_id || breakdown?.project_id || screenplay?.project_id || story?.project_id || 'default_project';
  const title = options.title || plan.title || breakdown?.title || screenplay?.title || story?.title || 'Untitled Production';

  // Perform cross-component fidelity validation
  validateExportFidelity({ screenplay, breakdown, budget, schedule });

  const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const metadata = {
    export_id: exportId,
    project_id: projectId,
    project_title: title,
    export_type: exportType,
    generated_at: new Date().toISOString(),
    application_version: '1.0.0',
    schema_version: '1.0'
  };

  const rawPackage = {
    metadata
  };

  switch (exportType) {
    case EXPORT_TYPES.FULL_PRODUCTION_PACKAGE:
    case EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP:
      if (story) rawPackage.story = StoryOutputSchema.parse(story);
      if (screenplay) rawPackage.screenplay = ScreenplayOutputSchema.parse(screenplay);
      if (breakdown) rawPackage.breakdown = ProductionBreakdownSchema.parse(breakdown);
      if (budget) rawPackage.budget = BudgetOutputSchema.parse(budget);
      if (schedule) rawPackage.schedule = ScheduleOutputSchema.parse(schedule);
      if (insights) rawPackage.insights = insights;
      break;

    case EXPORT_TYPES.SCREENPLAY:
    case EXPORT_TYPES.SCREENPLAY_PDF:
      if (story) rawPackage.story = StoryOutputSchema.parse(story);
      if (screenplay) rawPackage.screenplay = ScreenplayOutputSchema.parse(screenplay);
      break;

    case EXPORT_TYPES.BREAKDOWN:
    case EXPORT_TYPES.BREAKDOWN_CSV:
      if (breakdown) rawPackage.breakdown = ProductionBreakdownSchema.parse(breakdown);
      else throw new Error('Export creation failed: Production Breakdown data is missing for BREAKDOWN export.');
      break;

    case EXPORT_TYPES.BUDGET:
    case EXPORT_TYPES.BUDGET_PDF:
    case EXPORT_TYPES.BUDGET_CSV:
    case EXPORT_TYPES.BUDGET_XLSX:
      if (budget) rawPackage.budget = BudgetOutputSchema.parse(budget);
      else throw new Error('Export creation failed: Budget data is missing for BUDGET export.');
      break;

    case EXPORT_TYPES.SCHEDULE:
    case EXPORT_TYPES.SCHEDULE_PDF:
    case EXPORT_TYPES.SCHEDULE_CSV:
    case EXPORT_TYPES.SCHEDULE_XLSX:
      if (schedule) rawPackage.schedule = ScheduleOutputSchema.parse(schedule);
      else throw new Error('Export creation failed: Schedule data is missing for SCHEDULE export.');
      break;

    case EXPORT_TYPES.INSIGHTS:
      if (insights) rawPackage.insights = insights;
      else throw new Error('Export creation failed: Insights data is missing for INSIGHTS export.');
      break;

    default:
      throw new Error(`Unsupported export type: ${exportType}`);
  }

  const sanitized = sanitizeExportPayload(rawPackage);
  return ProductionExportPackageSchema.parse(sanitized);
}

/**
 * Renders a PDF, CSV, or ZIP file buffer/content for export types.
 * @param {object} exportPackage Canonical export package
 * @param {string} exportType Export type
 * @returns {Promise<Buffer|string>} Generated export output
 */
export async function generateExportFileContent(exportPackage, exportType) {
  switch (exportType) {
    case EXPORT_TYPES.SCREENPLAY_PDF:
      return await generateScreenplayPdf(exportPackage);
    case EXPORT_TYPES.BUDGET_PDF:
      return await generateBudgetPdf(exportPackage);
    case EXPORT_TYPES.SCHEDULE_PDF:
      return await generateSchedulePdf(exportPackage);

    case EXPORT_TYPES.BREAKDOWN_CSV:
      return generateBreakdownCsv(exportPackage);
    case EXPORT_TYPES.BUDGET_CSV:
    case EXPORT_TYPES.BUDGET_XLSX:
      return generateBudgetCsv(exportPackage);
    case EXPORT_TYPES.SCHEDULE_CSV:
    case EXPORT_TYPES.SCHEDULE_XLSX:
      return generateScheduleCsv(exportPackage);

    case EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP:
      return await generateProductionBibleZip(exportPackage);

    default:
      return JSON.stringify(exportPackage, null, 2);
  }
}

export const generatePdfBufferForExport = generateExportFileContent;
export const buildCanonicalExportPackage = createExportPackage;
export const buildCanonicalExport = createExportPackage;

