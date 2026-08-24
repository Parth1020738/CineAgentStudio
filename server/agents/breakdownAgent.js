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

    Strict Output Requirements:
    1. Output ONLY valid JSON matching ProductionBreakdownSchema (no markdown formatting, no code fence block backticks).
    2. Set project_id and title EXACTLY as given in the screenplay.
    3. Maintain exact scene count, scene_number, scene_heading, and location from each screenplay scene.
    4. Set interior_exterior ('INT', 'EXT', or 'INT/EXT') based on the scene_heading.
    5. Set time_of_day ('DAY', 'NIGHT', 'DAWN', 'DUSK', or 'OTHER') based on the scene_heading and action.
    6. Extract characters present in dialogue/action for each scene.
    7. Identify extras_count (integer >= 0), props (string array), vehicles (string array), wardrobe (string array), makeup_fx (string array), special_equipment (string array), special_effects (string array), vfx (string array).
    8. Determine production_complexity ('LOW', 'MEDIUM', 'HIGH') based on cast size, location type, night shoot, equipment, and effects.
    9. Estimate estimated_cost (non-negative numeric USD estimate, e.g. 15000, 35000) for producing the scene.
    10. Write concise production_notes explaining technical requirements or complexity rationale.
  `
});

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

Return the Production Breakdown JSON.`;

  const parsedPayload = await executeAgentWithPolicy({
    agentName: 'breakdown_agent',
    agent: breakdownAgent,
    userPrompt,
    parseAndValidate: (extracted) => {
      const parsed = ProductionBreakdownSchema.parse(extracted);
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
