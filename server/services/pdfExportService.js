import PDFDocument from 'pdfkit';
import { sanitizeExportPayload } from './exportService.js';

/**
 * Generates a professional Screenplay PDF document from a validated canonical export package.
 * @param {object} exportPackage Canonical export package containing screenplay data
 * @returns {Promise<Buffer>} PDF file Buffer
 */
export function generateScreenplayPdf(exportPackage) {
  return new Promise((resolve, reject) => {
    try {
      const cleanPkg = sanitizeExportPayload(exportPackage);
      const screenplay = cleanPkg.screenplay;
      if (!screenplay || !Array.isArray(screenplay.scenes) || screenplay.scenes.length === 0) {
        throw new Error('PDF Generation Error: Screenplay data is missing or empty.');
      }

      const doc = new PDFDocument({ margin: 54, size: 'LETTER' });
      const buffers = [];

      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const title = screenplay.title || cleanPkg.metadata?.project_title || 'Untitled Screenplay';

      // Header Banner
      doc.font('Courier-Bold').fontSize(18).text(title.toUpperCase(), { align: 'center' });
      doc.font('Courier').fontSize(10).text('OFFICIAL SCREENPLAY SPECIFICATION', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(54, doc.y).lineTo(558, doc.y).stroke('#333333');
      doc.moveDown(1.5);

      // Scenes Rendering
      screenplay.scenes.forEach((scene, index) => {
        // Scene Heading
        const headingStr = `${scene.scene_number || index + 1}. ${(scene.scene_heading || 'INT. UNKNOWN - DAY').toUpperCase()}`;
        doc.font('Courier-Bold').fontSize(11).fillColor('#000000').text(headingStr);
        doc.moveDown(0.4);

        // Action Block
        if (scene.action) {
          doc.font('Courier').fontSize(10).fillColor('#222222').text(scene.action, {
            align: 'justify',
            lineGap: 2
          });
          doc.moveDown(0.6);
        }

        // Dialogue Blocks
        if (Array.isArray(scene.dialogue)) {
          scene.dialogue.forEach(d => {
            if (d.character) {
              doc.font('Courier-Bold').fontSize(10).fillColor('#000000').text(d.character.toUpperCase(), {
                align: 'center'
              });
            }
            if (d.line) {
              doc.font('Courier').fontSize(10).fillColor('#111111').text(d.line, {
                indent: 72,
                lineGap: 2
              });
            }
            doc.moveDown(0.4);
          });
        }

        // Transition
        if (scene.transition) {
          doc.font('Courier-Bold').fontSize(10).fillColor('#444444').text(scene.transition.toUpperCase(), {
            align: 'right'
          });
        }

        doc.moveDown(1.2);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a professional Line-Item Budget Report PDF from a validated canonical export package.
 * @param {object} exportPackage Canonical export package containing budget data
 * @returns {Promise<Buffer>} PDF file Buffer
 */
export function generateBudgetPdf(exportPackage) {
  return new Promise((resolve, reject) => {
    try {
      const cleanPkg = sanitizeExportPayload(exportPackage);
      const budget = cleanPkg.budget;
      if (!budget) {
        throw new Error('PDF Generation Error: Budget data is missing.');
      }

      const doc = new PDFDocument({ margin: 54, size: 'LETTER' });
      const buffers = [];

      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const title = budget.title || cleanPkg.metadata?.project_title || 'Untitled Project';

      // Header Section
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(title);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#3b82f6').text('PRODUCTION BUDGET REPORT');
      doc.moveDown(0.5);
      doc.moveTo(54, doc.y).lineTo(558, doc.y).stroke('#e2e8f0');
      doc.moveDown(1);

      // Financial Metrics Cards
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('FINANCIAL OVERVIEW');
      doc.font('Helvetica').fontSize(10).fillColor('#475569');
      
      const formatCurr = val => typeof val === 'number' ? `$${val.toLocaleString()}` : (val || '$0');

      doc.text(`Target Budget: ${formatCurr(budget.target_budget)}`);
      doc.text(`Estimated Total: ${formatCurr(budget.estimated_total)}`);
      doc.text(`Budget Status: ${budget.budget_status || 'AT_TARGET'}`);
      doc.text(`Target Variance: ${formatCurr(budget.target_variance)}`);
      doc.moveDown(1);

      // Reconciliation Equation Box
      if (budget.budget_reconciliation) {
        const rec = budget.budget_reconciliation;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('BUDGET RECONCILIATION FORMULA');
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        doc.text(`Scene-Linked Cost Total: ${formatCurr(rec.scene_linked_cost_total)}`);
        doc.text(`+ Project-Wide Cost Total: ${formatCurr(rec.project_wide_cost_total)}`);
        doc.text(`+ Contingency Cost Reserve: ${formatCurr(rec.contingency_cost)}`);
        doc.font('Helvetica-Bold').text(`= Reconciled Total: ${formatCurr(rec.estimated_total)}`);
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b').text(`Explanation: ${rec.explanation || 'Reconciled'}`);
        doc.moveDown(1);
      }

      // Categories Breakdown Table
      if (Array.isArray(budget.categories) && budget.categories.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('BUDGET CATEGORY BREAKDOWN');
        doc.moveDown(0.3);

        budget.categories.forEach(cat => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(`${cat.category}: ${formatCurr(cat.estimated_cost)}`);
          if (cat.explanation) {
            doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`  ${cat.explanation}`);
          }
          doc.moveDown(0.3);
        });
        doc.moveDown(0.8);
      }

      // Major Cost Drivers
      if (Array.isArray(budget.major_cost_drivers) && budget.major_cost_drivers.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('MAJOR COST DRIVERS');
        budget.major_cost_drivers.forEach(driver => {
          doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`• [${driver.impact_level || 'MEDIUM'}] ${driver.driver_name}: ${driver.description || ''}`);
        });
        doc.moveDown(0.8);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a professional Shooting Schedule Report PDF from a validated canonical export package.
 * @param {object} exportPackage Canonical export package containing schedule data
 * @returns {Promise<Buffer>} PDF file Buffer
 */
export function generateSchedulePdf(exportPackage) {
  return new Promise((resolve, reject) => {
    try {
      const cleanPkg = sanitizeExportPayload(exportPackage);
      const schedule = cleanPkg.schedule;
      if (!schedule || !Array.isArray(schedule.days) || schedule.days.length === 0) {
        throw new Error('PDF Generation Error: Schedule data is missing or empty.');
      }

      const doc = new PDFDocument({ margin: 54, size: 'LETTER' });
      const buffers = [];

      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const title = schedule.title || cleanPkg.metadata?.project_title || 'Untitled Project';

      // Title & Overview Header
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(title);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#059669').text('PRODUCTION SHOOTING SCHEDULE (STRIPBOARD)');
      doc.moveDown(0.5);
      doc.moveTo(54, doc.y).lineTo(558, doc.y).stroke('#e2e8f0');
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text(`Total Shoot Days: ${schedule.total_shoot_days || schedule.days.length}`);
      
      if (schedule.optimization_summary) {
        const opt = schedule.optimization_summary;
        doc.font('Helvetica').fontSize(9).fillColor('#475569');
        doc.text(`Locations Consolidated: ${opt.locations_consolidated || 1} | Night Blocks: ${opt.night_blocks || 0} | Estimated Location Moves: ${opt.estimated_location_moves || 0}`);
        if (opt.scheduling_notes) {
          doc.text(`Optimization Notes: ${opt.scheduling_notes}`);
        }
      }
      doc.moveDown(1);

      // Shooting Days Stripboard Cards
      schedule.days.forEach(day => {
        const dayHeader = `SHOOTING DAY ${day.shooting_day} (${day.date_label || 'Day ' + day.shooting_day}) — ${day.location} [${day.time_of_day}]`;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(dayHeader);
        doc.font('Helvetica').fontSize(9).fillColor('#334155');

        doc.text(`  Scheduled Scenes: ${Array.isArray(day.scenes) ? day.scenes.join(', ') : 'None'}`);
        doc.text(`  Required Cast: ${Array.isArray(day.cast) ? day.cast.join(', ') : 'N/A'}`);
        doc.text(`  Extras Count: ${day.extras_count || 0} | Daily Cost: $${(day.estimated_day_cost || 0).toLocaleString()}`);
        if (day.setup_notes) doc.text(`  Setup & Rigging: ${day.setup_notes}`);
        if (day.rationale) doc.text(`  Scheduling Rationale: ${day.rationale}`);
        if (Array.isArray(day.risks) && day.risks.length > 0) doc.text(`  Production Risks: ${day.risks.join('; ')}`);
        
        doc.moveDown(0.8);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
