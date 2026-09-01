import JSZip from 'jszip';
import { createExportPackage, getSafeExportFilename, EXPORT_TYPES, sanitizeExportPayload } from './exportService.js';
import { generateScreenplayPdf, generateBudgetPdf, generateSchedulePdf } from './pdfExportService.js';
import { generateBreakdownCsv, generateBudgetCsv, generateScheduleCsv } from './csvExportService.js';

/**
 * Renders a complete Production Bible ZIP archive buffer from a validated production plan / export package.
 * @param {object} exportPackage Canonical export package
 * @returns {Promise<Buffer>} ZIP archive file Buffer
 */
export async function generateProductionBibleZip(input) {
  const exportPackage = input && input.metadata ? input : createExportPackage({ productionPlan: input });
  const cleanPkg = sanitizeExportPayload(exportPackage);
  const title = cleanPkg.metadata?.project_title || cleanPkg.title || 'project';
  const cleanSlug = title
    .toString()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  const folderName = `${cleanSlug || 'project'}-production-bible`;
  const zip = new JSZip();
  const folder = zip.folder(folderName);

  // 1. JSON Files
  folder.file('production-package.json', JSON.stringify(cleanPkg, null, 2));

  if (cleanPkg.story) {
    folder.file('story.json', JSON.stringify(cleanPkg.story, null, 2));
  }
  if (cleanPkg.screenplay) {
    folder.file('screenplay.json', JSON.stringify(cleanPkg.screenplay, null, 2));
  }
  if (cleanPkg.breakdown) {
    folder.file('breakdown.json', JSON.stringify(cleanPkg.breakdown, null, 2));
  }
  if (cleanPkg.budget) {
    folder.file('budget.json', JSON.stringify(cleanPkg.budget, null, 2));
  }
  if (cleanPkg.schedule) {
    folder.file('schedule.json', JSON.stringify(cleanPkg.schedule, null, 2));
  }
  if (cleanPkg.insights) {
    folder.file('insights.json', JSON.stringify(cleanPkg.insights, null, 2));
  }

  // 2. CSV Files
  if (cleanPkg.breakdown) {
    folder.file('breakdown.csv', generateBreakdownCsv(cleanPkg));
  }
  if (cleanPkg.budget) {
    folder.file('budget.csv', generateBudgetCsv(cleanPkg));
  }
  if (cleanPkg.schedule) {
    folder.file('schedule.csv', generateScheduleCsv(cleanPkg));
  }

  // 3. PDF Files
  if (cleanPkg.screenplay) {
    const pdfBuf = await generateScreenplayPdf(cleanPkg);
    folder.file('screenplay.pdf', pdfBuf);
  }
  if (cleanPkg.budget) {
    const pdfBuf = await generateBudgetPdf(cleanPkg);
    folder.file('budget.pdf', pdfBuf);
  }
  if (cleanPkg.schedule) {
    const pdfBuf = await generateSchedulePdf(cleanPkg);
    folder.file('schedule.pdf', pdfBuf);
  }

  const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
  return zipContent;
}
