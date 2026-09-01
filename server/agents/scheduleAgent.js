import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ProductionBreakdownSchema } from './breakdownAgent.js';
import { BudgetOutputSchema } from './budgetAgent.js';
import { getGeminiModel, executeAgentWithPolicy, extractJsonFromText } from '../config/geminiConfig.js';

export { extractJsonFromText };

dotenv.config();

// Input Schema for Schedule Agent accepting production breakdown and optional budget
export const ScheduleInputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  target_shoot_days: z.number().int().positive('target_shoot_days must be a positive integer.').optional(),
  production_breakdown: ProductionBreakdownSchema,
  budget: BudgetOutputSchema.optional()
});

// Shooting Day Schema
export const ShootingDaySchema = z.object({
  shooting_day: z.number().int().positive('shooting_day must be a positive integer.'),
  date_label: z.string().trim().min(1, 'date_label cannot be empty.'),
  location: z.string().trim().min(1, 'location cannot be empty.'),
  time_of_day: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'OTHER'], {
    errorMap: () => ({ message: 'time_of_day must be DAY, NIGHT, DAWN, DUSK, or OTHER.' })
  }),
  scenes: z.array(z.number().int().positive()).min(1, 'At least one scene must be scheduled per shooting day.'),
  cast: z.array(z.string()),
  extras_count: z.number().int().nonnegative('extras_count must be a non-negative integer.'),
  estimated_day_cost: z.number().nonnegative('estimated_day_cost must be a non-negative number.'),
  setup_notes: z.string().trim().min(1, 'setup_notes cannot be empty.'),
  rationale: z.string().trim().min(1, 'rationale cannot be empty.'),
  risks: z.array(z.string())
});

export { ShootingDaySchema as DayPlanSchema };

// Schedule Optimization Summary Schema
export const ScheduleOptimizationSummarySchema = z.object({
  locations_consolidated: z.number().int().nonnegative(),
  night_blocks: z.number().int().nonnegative(),
  estimated_location_moves: z.number().int().nonnegative(),
  estimated_shoot_days: z.number().int().positive(),
  scheduling_notes: z.string().trim().min(1, 'scheduling_notes cannot be empty.')
});

export { ScheduleOptimizationSummarySchema as OptimizationSummarySchema };

// Complete Schedule Output Schema
export const ScheduleOutputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  total_shoot_days: z.number().int().positive('total_shoot_days must be a positive integer.'),
  days: z.array(ShootingDaySchema).min(1, 'Schedule must contain at least 1 shooting day.'),
  optimization_summary: ScheduleOptimizationSummarySchema,
  assumptions: z.array(z.string())
});

/**
 * Validates schedule fidelity against input production breakdown and budget.
 * Enforces scene coverage equality (every breakdown scene assigned exactly once).
 * @param {object} breakdown Production breakdown source of truth
 * @param {object|undefined} budget Budget source of truth
 * @param {object} schedule Generated schedule payload
 * @returns {boolean} True if valid
 */
export function validateScheduleFidelity(breakdown, budget, schedule) {
  if (!breakdown || !schedule) {
    throw new Error('Schedule validation failed: Missing breakdown or schedule payload.');
  }

  if (schedule.project_id !== breakdown.project_id) {
    throw new Error(`Schedule validation failed: project_id "${schedule.project_id}" does not match Breakdown project_id "${breakdown.project_id}".`);
  }

  if (schedule.title.toLowerCase().trim() !== breakdown.title.toLowerCase().trim()) {
    throw new Error(`Schedule validation failed: title "${schedule.title}" does not match breakdown title "${breakdown.title}".`);
  }

  if (schedule.total_shoot_days !== schedule.days.length) {
    throw new Error(`Schedule validation failed: total_shoot_days (${schedule.total_shoot_days}) does not match days array length (${schedule.days.length}).`);
  }

  const breakdownScenes = breakdown.scenes.map(s => s.scene_number);
  const scheduledScenes = schedule.days.flatMap(d => d.scenes);

  const seenScenes = new Set();
  for (const sNum of scheduledScenes) {
    if (seenScenes.has(sNum)) {
      throw new Error(`Schedule validation failed: Duplicate scene assignment. Scene ${sNum} is scheduled multiple times.`);
    }
    seenScenes.add(sNum);
  }

  for (const bNum of breakdownScenes) {
    if (!seenScenes.has(bNum)) {
      throw new Error(`Schedule validation failed: Scene count mismatch. Scene ${bNum} from breakdown is missing in the schedule.`);
    }
  }

  for (let i = 0; i < schedule.days.length; i++) {
    const day = schedule.days[i];
    if (day.shooting_day !== i + 1) {
      throw new Error(`Schedule validation failed: Non-sequential shooting day (${day.shooting_day}) at day index ${i}.`);
    }
  }

  return true;
}

/**
 * Helper to safely parse numeric values without producing NaN.
 * @param {any} val Value to parse
 * @param {number|undefined} defaultVal Default fallback value
 * @returns {number|undefined} Parsed number
 */
export function parseSafeNumber(val, defaultVal = 0) {
  if (typeof val === 'number' && !isNaN(val)) {
    return val;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[\$,\s]/g, '');
    const parsed = Number(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultVal;
}

/**
 * Deterministic normalizer for Schedule Agent payloads.
 * Maps unambiguous field aliases, coercing strings/enums safely without fabricating content.
 * @param {object} rawJson Raw JSON object
 * @param {string} defaultProjectId Fallback project ID from input
 * @param {string} defaultTitle Fallback title from input
 * @returns {object} Normalized object ready for ScheduleOutputSchema validation
 */
export function normalizeSchedulePayload(rawJson, defaultProjectId = 'default_project', defaultTitle = 'Untitled Project') {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Schedule Agent output must be a valid JSON object.');
  }

  const safeString = (val, fallback = '') => {
    if (val == null) return fallback;
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
  };

  let root = rawJson;
  if (rawJson.shooting_schedule && typeof rawJson.shooting_schedule === 'object' && !Array.isArray(rawJson.shooting_schedule)) {
    root = rawJson.shooting_schedule;
  } else if (rawJson.schedule && typeof rawJson.schedule === 'object' && !Array.isArray(rawJson.schedule)) {
    root = rawJson.schedule;
  }

  const normalized = {};

  // Force canonical metadata from source parameters when available
  normalized.project_id = safeString(root.project_id || root.projectId || rawJson.project_id, defaultProjectId);
  normalized.title = safeString(root.title || rawJson.title, defaultTitle);

  let rawDays = [];
  if (Array.isArray(rawJson.days)) {
    rawDays = rawJson.days;
  } else if (Array.isArray(rawJson.shooting_schedule)) {
    rawDays = rawJson.shooting_schedule;
  } else if (Array.isArray(rawJson.schedule)) {
    rawDays = rawJson.schedule;
  } else if (Array.isArray(rawJson.shooting_days)) {
    rawDays = rawJson.shooting_days;
  } else if (Array.isArray(rawJson.day_plan)) {
    rawDays = rawJson.day_plan;
  } else if (Array.isArray(root.days)) {
    rawDays = root.days;
  } else if (root.schedule && Array.isArray(root.schedule.days)) {
    rawDays = root.schedule.days;
  }

  normalized.days = rawDays.map((d, index) => {
    let tod = safeString(d?.time_of_day || d?.timeOfDay || d?.time, 'DAY').toUpperCase();
    if (tod.includes('NIGHT')) tod = 'NIGHT';
    else if (tod.includes('DAY')) tod = 'DAY';
    else if (tod.includes('DAWN')) tod = 'DAWN';
    else if (tod.includes('DUSK')) tod = 'DUSK';
    else tod = 'OTHER';

    const rawScenes = Array.isArray(d?.scenes) ? d.scenes : (d?.scene != null ? [d.scene] : []);
    const parsedScenes = rawScenes
      .map(s => {
        if (typeof s === 'number' && !isNaN(s)) return s;
        if (typeof s === 'object' && s !== null) {
          const num = s.scene_number || s.scene_id || s.scene || s.id || s.number;
          return parseSafeNumber(num, null);
        }
        if (typeof s === 'string') {
          const match = s.match(/\d+/);
          if (match) return Number(match[0]);
        }
        return parseSafeNumber(s, null);
      })
      .filter(s => typeof s === 'number' && !isNaN(s) && s > 0);

    const rawCast = Array.isArray(d?.cast) ? d.cast : (d?.cast ? [d.cast] : []);
    const parsedCast = rawCast.map(c => safeString(c)).filter(Boolean);

    const rawRisks = Array.isArray(d?.risks) ? d.risks : (d?.risk ? [d.risk] : []);
    const parsedRisks = rawRisks.map(r => safeString(r)).filter(Boolean);

    return {
      shooting_day: parseSafeNumber(d?.shooting_day || d?.day || d?.day_number, index + 1),
      date_label: safeString(d?.date_label || d?.date || d?.day_label, `Day ${index + 1}`),
      location: safeString(d?.location || d?.location_name, 'Location'),
      time_of_day: tod,
      scenes: parsedScenes,
      cast: parsedCast,
      extras_count: parseSafeNumber(d?.extras_count || d?.extras, 0),
      estimated_day_cost: parseSafeNumber(d?.estimated_day_cost || d?.day_cost || d?.cost, 0),
      setup_notes: safeString(d?.setup_notes || d?.setup || d?.notes, 'Standard day setup.'),
      rationale: safeString(d?.rationale || d?.reason || d?.scheduling_rationale, 'Scheduled based on location and crew efficiency.'),
      risks: parsedRisks.length > 0 ? parsedRisks : ['Turnaround time management']
    };
  });

  normalized.total_shoot_days = parseSafeNumber(rawJson.total_shoot_days || rawJson.totalShootDays || root.total_shoot_days, normalized.days.length || 1);

  const rawOpt = rawJson.optimization_summary || rawJson.optimizationSummary || root.optimization_summary || {};
  normalized.optimization_summary = {
    locations_consolidated: parseSafeNumber(rawOpt.locations_consolidated || rawOpt.locationsConsolidated, 1),
    night_blocks: parseSafeNumber(rawOpt.night_blocks || rawOpt.nightBlocks, 0),
    estimated_location_moves: parseSafeNumber(rawOpt.estimated_location_moves || rawOpt.locationMoves, 0),
    estimated_shoot_days: parseSafeNumber(rawOpt.estimated_shoot_days || rawOpt.estimatedShootDays, normalized.total_shoot_days),
    scheduling_notes: safeString(rawOpt.scheduling_notes || rawOpt.notes || rawOpt.summary, 'Schedule optimized for minimal company moves.')
  };

  const rawAssumptions = Array.isArray(rawJson.assumptions) ? rawJson.assumptions : (rawJson.assumptions ? [rawJson.assumptions] : []);
  normalized.assumptions = rawAssumptions.map(a => safeString(a)).filter(Boolean);
  if (normalized.assumptions.length === 0) {
    normalized.assumptions = ['Consecutive soundstage booking available'];
  }

  return normalized;
}

/**
 * Deterministically repairs structural assignment errors in a schedule candidate object.
 * Corrects duplicate scenes, missing scenes, empty days, and non-sequential day numbers
 * using strictly authoritative source data from productionBreakdown and budget.
 *
 * @param {object} candidate Candidate normalized schedule payload
 * @param {object} breakdown Authoritative production breakdown
 * @param {object|undefined} budget Authoritative budget
 * @param {number|undefined} targetShootDays Optional requested target shoot days
 * @returns {object} Structurally repaired schedule payload ready for Zod and fidelity validation
 */
export function repairScheduleAssignments(candidate, breakdown, budget, targetShootDays) {
  if (!breakdown || !breakdown.scenes || breakdown.scenes.length === 0) {
    throw new Error('Deterministic repair failed: Breakdown contains no valid scenes.');
  }

  const projectId = breakdown.project_id;
  const title = breakdown.title;

  const sourceScenes = breakdown.scenes;
  const sourceSceneNums = sourceScenes.map(s => s.scene_number);
  const sourceSceneSet = new Set(sourceSceneNums);

  const sceneCostMap = new Map();
  if (budget && Array.isArray(budget.scene_costs)) {
    for (const sc of budget.scene_costs) {
      sceneCostMap.set(sc.scene_number, parseSafeNumber(sc.estimated_cost, 0));
    }
  }
  for (const s of sourceScenes) {
    if (!sceneCostMap.has(s.scene_number)) {
      sceneCostMap.set(s.scene_number, parseSafeNumber(s.estimated_cost, 0));
    }
  }

  const sceneMetaMap = new Map();
  for (const s of sourceScenes) {
    sceneMetaMap.set(s.scene_number, s);
  }

  let days = Array.isArray(candidate?.days) ? candidate.days : [];

  const assignedSet = new Set();
  const cleanedDays = [];

  for (let i = 0; i < days.length; i++) {
    const rawDay = days[i];
    const rawScenes = Array.isArray(rawDay?.scenes) ? rawDay.scenes : [];
    const validScenesForDay = [];

    for (const num of rawScenes) {
      if (sourceSceneSet.has(num) && !assignedSet.has(num)) {
        assignedSet.add(num);
        validScenesForDay.push(num);
      }
    }

    cleanedDays.push({
      ...rawDay,
      shooting_day: i + 1,
      scenes: validScenesForDay
    });
  }

  const missingScenes = sourceSceneNums.filter(n => !assignedSet.has(n));

  let targetDays = cleanedDays.length;
  if (targetShootDays && targetShootDays > 0) {
    targetDays = Math.min(targetShootDays, sourceSceneNums.length);
  }
  if (targetDays <= 0) {
    targetDays = Math.min(3, sourceSceneNums.length);
  }
  targetDays = Math.max(1, Math.min(targetDays, sourceSceneNums.length));

  let activeDays = cleanedDays.filter(d => d.scenes.length > 0);
  if (activeDays.length === 0) {
    const firstScene = sceneMetaMap.get(sourceSceneNums[0]);
    activeDays = [
      {
        shooting_day: 1,
        date_label: 'Day 1',
        location: firstScene?.location || 'Location 1',
        time_of_day: firstScene?.time_of_day || 'DAY',
        scenes: [],
        cast: firstScene?.characters || [],
        extras_count: firstScene?.extras_count || 0,
        estimated_day_cost: 0,
        setup_notes: 'Standard production setup.',
        rationale: 'Primary production day.',
        risks: ['Schedule turnaround']
      }
    ];
  }

  while (activeDays.length < targetDays && missingScenes.length > 0) {
    const nextSceneNum = missingScenes[0];
    const nextSceneMeta = sceneMetaMap.get(nextSceneNum);
    activeDays.push({
      shooting_day: activeDays.length + 1,
      date_label: `Day ${activeDays.length + 1}`,
      location: nextSceneMeta?.location || 'Location',
      time_of_day: nextSceneMeta?.time_of_day || 'DAY',
      scenes: [],
      cast: nextSceneMeta?.characters || [],
      extras_count: nextSceneMeta?.extras_count || 0,
      estimated_day_cost: 0,
      setup_notes: 'Production setup.',
      rationale: 'Scheduled day for remaining scenes.',
      risks: ['Turnaround management']
    });
  }

  let dayIdx = 0;
  for (const mNum of missingScenes) {
    activeDays[dayIdx % activeDays.length].scenes.push(mNum);
    assignedSet.add(mNum);
    dayIdx++;
  }

  const finalDays = activeDays.map((day, idx) => {
    const dayScenes = day.scenes;
    const dayCastSet = new Set(Array.isArray(day.cast) ? day.cast : []);
    let dayCost = 0;

    for (const sNum of dayScenes) {
      const meta = sceneMetaMap.get(sNum);
      if (meta) {
        (meta.characters || []).forEach(c => dayCastSet.add(c));
      }
      dayCost += (sceneCostMap.get(sNum) || 0);
    }

    return {
      shooting_day: idx + 1,
      date_label: day.date_label || `Day ${idx + 1}`,
      location: day.location || sceneMetaMap.get(dayScenes[0])?.location || 'Location',
      time_of_day: day.time_of_day || sceneMetaMap.get(dayScenes[0])?.time_of_day || 'DAY',
      scenes: dayScenes,
      cast: Array.from(dayCastSet),
      extras_count: parseSafeNumber(day.extras_count, 0),
      estimated_day_cost: dayCost,
      setup_notes: day.setup_notes || 'Standard day setup.',
      rationale: day.rationale || 'Scheduled for optimal production workflow.',
      risks: Array.isArray(day.risks) && day.risks.length > 0 ? day.risks : ['Turnaround management']
    };
  });

  return {
    project_id: projectId,
    title: title,
    total_shoot_days: finalDays.length,
    days: finalDays,
    optimization_summary: {
      locations_consolidated: parseSafeNumber(candidate?.optimization_summary?.locations_consolidated, 1),
      night_blocks: parseSafeNumber(candidate?.optimization_summary?.night_blocks, 0),
      estimated_location_moves: parseSafeNumber(candidate?.optimization_summary?.estimated_location_moves, 0),
      estimated_shoot_days: finalDays.length,
      scheduling_notes: candidate?.optimization_summary?.scheduling_notes || 'Schedule structurally repaired and verified.'
    },
    assumptions: Array.isArray(candidate?.assumptions) && candidate.assumptions.length > 0
      ? candidate.assumptions
      : ['Consecutive soundstage booking available']
  };
}

/**
 * Executes the Schedule Agent against a validated Production Breakdown & Budget.
 * @param {object} input Container with breakdown, budget, target_shoot_days
 * @returns {Promise<object>} Validated ScheduleOutputSchema object
 */
export async function runScheduleAgent(input) {
  const startTime = Date.now();

  if (!input || !input.production_breakdown) {
    throw new Error('Schedule Agent failed: Valid production_breakdown must be provided.');
  }

  const validatedInput = ScheduleInputSchema.parse({
    project_id: input.project_id || input.production_breakdown.project_id,
    title: input.title || input.production_breakdown.title,
    target_shoot_days: input.target_shoot_days ? Number(input.target_shoot_days) : undefined,
    production_breakdown: input.production_breakdown,
    budget: input.budget
  });

  const sourceSceneNumbers = validatedInput.production_breakdown.scenes.map(s => s.scene_number);

  const systemInstruction = `Return JSON only.

Create an optimized shooting schedule from the supplied source scenes.

Hard constraints:
- days must be non-empty
- every day must contain at least one scene
- every source scene must appear exactly once
- no scene may appear twice
- use only source scene numbers
- shooting_day values must be sequential
- project_id and title must match the supplied project
- total_shoot_days must equal days.length
- do not invent scenes
- do not invent costs
- preserve location/time/cast fidelity

Optimization goals:
- consolidate locations
- minimize location moves
- group compatible time-of-day blocks
- respect target shoot days
- minimize unnecessary company moves

Return only the final JSON object.`;

  const agent = new LlmAgent({
    name: 'schedule_agent',
    model: getGeminiModel(),
    description: 'Generates optimized production shooting schedules for film projects.',
    systemInstruction
  });

  const userPrompt = `
Generate the production shooting schedule for this project:

Project ID: ${validatedInput.project_id}
Title: ${validatedInput.title}
Target Shoot Days: ${validatedInput.target_shoot_days ? validatedInput.target_shoot_days : 'Auto-calculate based on breakdown'}
Source Scene Numbers: [${sourceSceneNumbers.join(', ')}]

PRODUCTION BREAKDOWN:
${JSON.stringify(validatedInput.production_breakdown, null, 2)}

PROJECT BUDGET:
${validatedInput.budget ? JSON.stringify(validatedInput.budget, null, 2) : 'N/A'}

IMPORTANT: project_id MUST be "${validatedInput.project_id}". title MUST be "${validatedInput.title}". Every breakdown scene from [${sourceSceneNumbers.join(', ')}] MUST appear in 'scenes' EXACTLY ONCE across all days. Top-level keys MUST be "project_id", "title", "total_shoot_days", "days", "optimization_summary", "assumptions". Respond ONLY with the raw JSON object.
`;

  let candidateJson = null;
  let initialValidationError = null;

  console.log('[schedule_agent] initial generation');
  try {
    const rawResult = await executeAgentWithPolicy({
      agentName: 'schedule_agent',
      agent,
      userPrompt,
      parseAndValidate: (extracted) => {
        candidateJson = extracted;
        const normalized = normalizeSchedulePayload(extracted, validatedInput.project_id, validatedInput.title);
        const validatedOutput = ScheduleOutputSchema.parse(normalized);
        validateScheduleFidelity(validatedInput.production_breakdown, validatedInput.budget, validatedOutput);
        return validatedOutput;
      }
    });

    console.log('[schedule_agent] final validation passed');
    return {
      ...rawResult,
      telemetry: {
        runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        projectId: rawResult.project_id,
        agentName: 'schedule_agent',
        durationMs: Date.now() - startTime
      }
    };
  } catch (err) {
    initialValidationError = err.message;
    console.warn(`[schedule_agent] validation failed: ${initialValidationError}`);
  }

  // Fallback to deterministic structural assignment repair if LLM validation failed
  if (candidateJson || validatedInput.production_breakdown) {
    try {
      console.log('[schedule_agent] deterministic structural repair');
      const normalizedCandidate = candidateJson ? normalizeSchedulePayload(candidateJson, validatedInput.project_id, validatedInput.title) : {};
      const repaired = repairScheduleAssignments(
        normalizedCandidate,
        validatedInput.production_breakdown,
        validatedInput.budget,
        validatedInput.target_shoot_days
      );

      const validatedRepaired = ScheduleOutputSchema.parse(repaired);
      validateScheduleFidelity(validatedInput.production_breakdown, validatedInput.budget, validatedRepaired);
      console.log('[schedule_agent] final validation passed');

      return {
        ...validatedRepaired,
        telemetry: {
          runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          projectId: validatedRepaired.project_id,
          agentName: 'schedule_agent',
          durationMs: Date.now() - startTime
        }
      };
    } catch (repairErr) {
      console.error(`[schedule_agent] validation failed: ${repairErr.message}`);
      throw new Error(`Schedule Agent failed: ${repairErr.message}`);
    }
  }

  throw new Error(`Schedule Agent failed: ${initialValidationError || 'No candidate schedule produced.'}`);
}
