import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ScreenplayOutputSchema } from './screenplayAgent.js';
import { getGeminiModel, executeAgentWithPolicy } from '../config/geminiConfig.js';

dotenv.config();

// Input Schema for Breakdown Agent accepting validated screenplay
export const BreakdownInputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  screenplay: ScreenplayOutputSchema
});

// Scene Breakdown Schema
export const SceneBreakdownSchema = z.object({
  scene_number: z.number().int().positive('scene_number must be a positive integer.'),
  scene_heading: z.string().trim().min(1, 'scene_heading cannot be empty.'),
  location: z.string().trim().min(1, 'location cannot be empty.'),
  interior_exterior: z.enum(['INT', 'EXT', 'INT/EXT'], {
    errorMap: () => ({ message: 'interior_exterior must be INT, EXT, or INT/EXT.' })
  }),
  time_of_day: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'OTHER'], {
    errorMap: () => ({ message: 'time_of_day must be DAY, NIGHT, DAWN, DUSK, or OTHER.' })
  }),
  characters: z.array(z.string()),
  extras_count: z.number().int().nonnegative('extras_count must be a non-negative integer.'),
  props: z.array(z.string()),
  vehicles: z.array(z.string()),
  wardrobe: z.array(z.string()),
  makeup_fx: z.array(z.string()),
  special_equipment: z.array(z.string()),
  special_effects: z.array(z.string()),
  vfx: z.array(z.string()),
  production_complexity: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    errorMap: () => ({ message: 'production_complexity must be LOW, MEDIUM, or HIGH.' })
  }),
  estimated_cost: z.number().nonnegative('estimated_cost must be a non-negative number.'),
  production_notes: z.string().trim().min(1, 'production_notes cannot be empty.')
});

// Production Breakdown Output Schema
export const ProductionBreakdownSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  scenes: z.array(SceneBreakdownSchema).min(1, 'At least one scene breakdown is required.')
});

/**
 * Validates alignment and fidelity between screenplay source of truth and production breakdown output.
 * @param {object} screenplay Validated Screenplay object
 * @param {object} breakdown Validated Production Breakdown object
 * @returns {boolean} True if alignment checks pass, throws Error otherwise.
 */
export function validateBreakdownFidelity(screenplay, breakdown) {
  if (!screenplay || !breakdown) {
    throw new Error('Breakdown validation failed: Missing screenplay or breakdown payload.');
  }

  if (breakdown.project_id !== screenplay.project_id) {
    throw new Error(`Breakdown validation failed: project_id "${breakdown.project_id}" does not match screenplay project_id "${screenplay.project_id}".`);
  }

  if (breakdown.title.toLowerCase().trim() !== screenplay.title.toLowerCase().trim()) {
    throw new Error(`Breakdown validation failed: title "${breakdown.title}" does not match screenplay title "${screenplay.title}".`);
  }

  if (!Array.isArray(breakdown.scenes) || breakdown.scenes.length !== screenplay.scenes.length) {
    throw new Error(`Breakdown validation failed: scene count (${breakdown.scenes?.length}) does not match screenplay scene count (${screenplay.scenes.length}).`);
  }

  for (let i = 0; i < screenplay.scenes.length; i++) {
    const sc = screenplay.scenes[i];
    const bd = breakdown.scenes[i];

    if (bd.scene_number !== sc.scene_number) {
      throw new Error(`Breakdown validation failed at scene index ${i}: Breakdown scene_number (${bd.scene_number}) does not match screenplay scene_number (${sc.scene_number}).`);
    }

    if (bd.scene_heading.toLowerCase().trim() !== sc.scene_heading.toLowerCase().trim()) {
      throw new Error(`Breakdown validation failed at scene ${sc.scene_number}: Breakdown scene_heading "${bd.scene_heading}" does not match screenplay scene_heading "${sc.scene_heading}".`);
    }

    const scLoc = sc.location.toLowerCase().trim();
    const bdLoc = bd.location.toLowerCase().trim();
    if (!scLoc.includes(bdLoc) && !bdLoc.includes(scLoc)) {
      throw new Error(`Breakdown validation failed at scene ${sc.scene_number}: Breakdown location "${bd.location}" does not align with screenplay location "${sc.location}".`);
    }
  }

  return true;
}

// Google ADK Production Breakdown Agent with centralized model
export const breakdownAgent = new LlmAgent({
  name: 'breakdown_agent',
  model: getGeminiModel(),
  instruction: `
    You are an expert film Production Breakdown Agent for CineAgent Studio.
    Your task is to analyze a validated Screenplay JSON object and transform it into a comprehensive, scene-by-scene Production Breakdown JSON object.

    STRICT OUTPUT FORMAT RULES:
    1. Respond ONLY with a single raw JSON object matching the exact top-level schema:
       {
         "project_id": "STRING",
         "title": "STRING",
         "scenes": [ ARRAY_OF_SCENE_BREAKDOWNS ]
       }
    2. Do NOT use top-level wrapper keys such as "production_breakdown", "breakdown", or "data". The top-level keys MUST be "project_id", "title", and "scenes".
    3. Do NOT wrap output in markdown code fences (\`\`\`json). Return raw JSON text starting with { and ending with }.
    4. Set project_id and title EXACTLY as given in the screenplay. Do NOT invent a different title.
    5. Maintain EXACT scene count, scene_number, scene_heading, and location from each screenplay scene. Every screenplay scene MUST appear exactly once in order.
    6. Set interior_exterior ('INT', 'EXT', or 'INT/EXT') based on the scene_heading.
    7. Set time_of_day ('DAY', 'NIGHT', 'DAWN', 'DUSK', or 'OTHER') based on the scene_heading and action.
    8. Extract characters present in dialogue/action for each scene.
    9. Identify extras_count (integer >= 0), props (string array), vehicles (string array), wardrobe (string array), makeup_fx (string array), special_equipment (string array), special_effects (string array), vfx (string array).
    10. Determine production_complexity ('LOW', 'MEDIUM', 'HIGH') based on cast size, location type, night shoot, equipment, and effects.
    11. Estimate estimated_cost (non-negative numeric USD estimate, e.g. 15000, 35000) for producing the scene.
    12. Write concise production_notes explaining technical requirements or complexity rationale.
  `
});

/**
 * Helper to safely parse numeric values without producing NaN.
 */
function parseSafeNumber(val, defaultVal = 0) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[\$,\s]/g, '');
    const parsed = Number(cleaned);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultVal;
}

/**
 * Deterministic normalizer for Production Breakdown payloads.
 * Handles top-level wrapper objects and unambiguous aliases without fabricating missing scenes.
 * @param {object} rawJson Raw JSON object
 * @param {string} defaultProjectId Fallback project ID from input
 * @param {string} defaultTitle Fallback title from input
 * @returns {object} Normalized object ready for ProductionBreakdownSchema validation
 */
export function normalizeBreakdownPayload(rawJson, defaultProjectId = 'default_project', defaultTitle = 'Untitled Project') {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Breakdown Agent output must be a valid JSON object.');
  }

  const safeString = (val, fallback = '') => {
    if (val == null) return fallback;
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
  };

  let root = rawJson;
  if (rawJson.production_breakdown && typeof rawJson.production_breakdown === 'object' && !Array.isArray(rawJson.production_breakdown)) {
    root = rawJson.production_breakdown;
  }

  const normalized = {};
  normalized.project_id = safeString(root.project_id || root.projectId || rawJson.project_id, defaultProjectId);
  normalized.title = safeString(root.title || rawJson.title, defaultTitle);

  let rawScenes = [];
  if (Array.isArray(root.scenes)) {
    rawScenes = root.scenes;
  } else if (Array.isArray(rawJson.scenes)) {
    rawScenes = rawJson.scenes;
  } else if (Array.isArray(rawJson.breakdown)) {
    rawScenes = rawJson.breakdown;
  } else if (Array.isArray(root.breakdown)) {
    rawScenes = root.breakdown;
  } else if (Array.isArray(rawJson.scene_breakdowns)) {
    rawScenes = rawJson.scene_breakdowns;
  }

  normalized.scenes = rawScenes.map((s, index) => {
    let ie = safeString(s?.interior_exterior || s?.int_ext || s?.interiorExterior, 'INT').toUpperCase();
    if (ie.includes('INT') && ie.includes('EXT')) ie = 'INT/EXT';
    else if (ie.includes('EXT')) ie = 'EXT';
    else ie = 'INT';

    let tod = safeString(s?.time_of_day || s?.timeOfDay || s?.time, 'DAY').toUpperCase();
    if (tod.includes('NIGHT')) tod = 'NIGHT';
    else if (tod.includes('DAY')) tod = 'DAY';
    else if (tod.includes('DAWN')) tod = 'DAWN';
    else if (tod.includes('DUSK')) tod = 'DUSK';
    else tod = 'OTHER';

    let comp = safeString(s?.production_complexity || s?.complexity, 'MEDIUM').toUpperCase();
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(comp)) comp = 'MEDIUM';

    const parseStrArray = arr => Array.isArray(arr) ? arr.map(x => safeString(x)).filter(Boolean) : (arr ? [safeString(arr)] : []);

    return {
      scene_number: parseSafeNumber(s?.scene_number || s?.scene_id || s?.number, index + 1),
      scene_heading: safeString(s?.scene_heading || s?.heading, `SCENE ${index + 1}`),
      location: safeString(s?.location || s?.location_name, 'LOCATION'),
      interior_exterior: ie,
      time_of_day: tod,
      characters: parseStrArray(s?.characters || s?.cast),
      extras_count: parseSafeNumber(s?.extras_count || s?.extras, 0),
      props: parseStrArray(s?.props),
      vehicles: parseStrArray(s?.vehicles),
      wardrobe: parseStrArray(s?.wardrobe),
      makeup_fx: parseStrArray(s?.makeup_fx || s?.makeup),
      special_equipment: parseStrArray(s?.special_equipment || s?.equipment),
      special_effects: parseStrArray(s?.special_effects || s?.sfx),
      vfx: parseStrArray(s?.vfx),
      production_complexity: comp,
      estimated_cost: parseSafeNumber(s?.estimated_cost || s?.cost, 0),
      production_notes: safeString(s?.production_notes || s?.notes, 'Standard scene requirements.')
    };
  });

  return normalized;
}

/**
 * Executes the Production Breakdown Agent against a validated screenplay input.
 * @param {object} input Object containing project_id, title, and screenplay
 * @returns {Promise<object>} Validated ProductionBreakdown object
 */
export async function runBreakdownAgent(input) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!input || !input.screenplay) {
    throw new Error('Breakdown Agent failed: Valid screenplay must be provided.');
  }

  const validatedInput = BreakdownInputSchema.parse({
    project_id: input.project_id || input.screenplay.project_id,
    title: input.title || input.screenplay.title,
    screenplay: input.screenplay
  });

  const screenplayJsonStr = JSON.stringify(validatedInput.screenplay, null, 2);
  const userPrompt = `Perform a detailed production breakdown for the following screenplay:

Project ID: ${validatedInput.project_id}
Title: ${validatedInput.title}

Screenplay JSON:
${screenplayJsonStr}

Return ONLY the Production Breakdown JSON matching the top-level schema: { "project_id": "${validatedInput.project_id}", "title": "${validatedInput.title}", "scenes": [...] }. Do NOT invent a different title.`;

  const parsedPayload = await executeAgentWithPolicy({
    agentName: 'breakdown_agent',
    agent: breakdownAgent,
    userPrompt,
    parseAndValidate: (extracted) => {
      const normalized = normalizeBreakdownPayload(extracted, validatedInput.project_id, validatedInput.title);
      const parsed = ProductionBreakdownSchema.parse(normalized);
      validateBreakdownFidelity(validatedInput.screenplay, parsed);
      return parsed;
    }
  });

  const durationMs = Date.now() - startTime;

  return {
    ...parsedPayload,
    telemetry: {
      runId,
      projectId: validatedInput.project_id,
      agentName: 'breakdown_agent',
      durationMs
    }
  };
}
