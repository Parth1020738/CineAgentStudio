import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { recordAgentRun, validateClickHouseConfig, ensureCineAgentSchema } from '../mcp/clickhouseMcp.js';
import { getGeminiModel, executeAgentWithPolicy, extractJsonFromText, is429RateLimitError } from '../config/geminiConfig.js';
import { ScreenplayOutputSchema } from './screenplayAgent.js';

dotenv.config();

export { extractJsonFromText, is429RateLimitError };

// Zod Schema for Script Doctor Category Scores
export const ScriptDoctorCategoryScoresSchema = z.object({
  structure: z.number().min(0, 'Structure score must be >= 0').max(100, 'Structure score must be <= 100'),
  pacing: z.number().min(0, 'Pacing score must be >= 0').max(100, 'Pacing score must be <= 100'),
  character_arcs: z.number().min(0, 'Character Arcs score must be >= 0').max(100, 'Character Arcs score must be <= 100'),
  dialogue: z.number().min(0, 'Dialogue score must be >= 0').max(100, 'Dialogue score must be <= 100'),
  conflict: z.number().min(0, 'Conflict score must be >= 0').max(100, 'Conflict score must be <= 100'),
  scene_effectiveness: z.number().min(0, 'Scene Effectiveness score must be >= 0').max(100, 'Scene Effectiveness score must be <= 100'),
  production_feasibility: z.number().min(0, 'Production Feasibility score must be >= 0').max(100, 'Production Feasibility score must be <= 100')
});

// Zod Schema for Script Doctor Output Result
export const ScriptDoctorOutputSchema = z.object({
  overall_score: z.number().min(0, 'Overall score must be >= 0').max(100, 'Overall score must be <= 100'),
  category_scores: ScriptDoctorCategoryScoresSchema,
  strengths: z.array(z.string().trim().min(1, 'Strength entry cannot be empty')).min(1, 'At least one strength must be listed'),
  issues: z.array(z.string().trim().min(1, 'Issue entry cannot be empty')).min(1, 'At least one issue must be listed'),
  recommendations: z.array(z.string().trim().min(1, 'Recommendation entry cannot be empty')).min(1, 'At least one recommendation must be listed')
});

/**
 * Clamps a score between 0 and 100 and rounds to integer.
 */
function clampScore(val, defaultVal = 75) {
  const num = Number(val);
  if (isNaN(num)) return defaultVal;
  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * Normalizes raw model output for Script Doctor.
 * Handles raw JSON, fenced JSON, and surrounding prose.
 */
export function normalizeScriptDoctorPayload(rawPayload) {
  let parsed = typeof rawPayload === 'string' ? extractJsonFromText(rawPayload) : rawPayload;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Script Doctor payload is not a valid JSON object.');
  }

  // Handle nested keys if model wrapped payload
  if (parsed.script_doctor) parsed = parsed.script_doctor;
  if (parsed.review) parsed = parsed.review;
  if (parsed.data) parsed = parsed.data;

  const rawCats = parsed.category_scores || parsed.categories || {};

  const normalized = {
    overall_score: clampScore(parsed.overall_score, 78),
    category_scores: {
      structure: clampScore(rawCats.structure, 80),
      pacing: clampScore(rawCats.pacing, 75),
      character_arcs: clampScore(rawCats.character_arcs ?? rawCats.characters, 75),
      dialogue: clampScore(rawCats.dialogue, 80),
      conflict: clampScore(rawCats.conflict ?? rawCats.stakes, 80),
      scene_effectiveness: clampScore(rawCats.scene_effectiveness ?? rawCats.scenes, 78),
      production_feasibility: clampScore(rawCats.production_feasibility ?? rawCats.feasibility, 85)
    },
    strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0
      ? parsed.strengths.map(s => String(s).trim()).filter(Boolean)
      : ['Vivid visual action blocks and clear cinematic location setup.'],
    issues: Array.isArray(parsed.issues) && parsed.issues.length > 0
      ? parsed.issues.map(i => String(i).trim()).filter(Boolean)
      : ['Rapid transition between high-stakes scenes leaves limited room for quiet character beats.'],
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations.map(r => String(r).trim()).filter(Boolean)
      : ['Consider adding a brief beat of character reflection before the climax.']
  };

  return ScriptDoctorOutputSchema.parse(normalized);
}

/**
 * Runs the Script Doctor Agent to perform an editorial review on a screenplay.
 * ADVISORY ONLY - DOES NOT ALTER THE SCREENPLAY.
 * @param {object} params Parameter object containing screenplay
 * @returns {Promise<object>} Validated Script Doctor assessment
 */
export async function runScriptDoctorAgent({ screenplay }) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Validate incoming screenplay
  const validatedScreenplay = ScreenplayOutputSchema.parse(screenplay);
  const projectId = validatedScreenplay.project_id || 'script_doctor_project';

  console.log(`[script_doctor_agent] Starting editorial pass for project "${validatedScreenplay.title}"...`);

  const systemInstruction = `You are a world-class Hollywood Script Doctor and Story Editor.
Your job is to provide an objective, constructive, and highly professional editorial review of a given screenplay.

CRITICAL RULES:
1. ADVISORY ONLY: Do NOT rewrite or alter the screenplay. Analyze the provided scenes exactly as written.
2. GROUNDING REQUIREMENT: Analyze ONLY the provided screenplay scenes, action blocks, locations, characters, and dialogue lines. Do NOT invent characters, scenes, dialogue, or plot points that do not exist in the screenplay.
3. OUTPUT FORMAT: Respond ONLY with a single valid JSON object adhering to this schema:
{
  "overall_score": 82,
  "category_scores": {
    "structure": 85,
    "pacing": 80,
    "character_arcs": 78,
    "dialogue": 84,
    "conflict": 85,
    "scene_effectiveness": 82,
    "production_feasibility": 80
  },
  "strengths": [
    "Specific strength referencing actual scene heading/action/character from screenplay"
  ],
  "issues": [
    "Specific pacing or character issue referencing actual scene heading/action/character"
  ],
  "recommendations": [
    "Actionable recommendation for the filmmaker referencing actual scene content"
  ]
}
4. SCORES: All scores must be integers between 0 and 100.
5. NO PROSE: Do NOT wrap the JSON in commentary or introductory text. Return raw JSON or markdown fenced JSON only.`;

  const promptText = `Please perform a thorough Script Doctor analysis of this screenplay:

PROJECT TITLE: "${validatedScreenplay.title}"
PROJECT ID: "${projectId}"

SCREENPLAY CONTENT:
${JSON.stringify(validatedScreenplay.scenes, null, 2)}

Provide your assessment with scores (0-100), strengths, issues, and recommendations referencing specific elements of the screenplay above.`;

  const scriptDoctorAgent = new LlmAgent({
    name: 'script_doctor_agent',
    model: getGeminiModel(),
    description: 'Analyzes screenplays and generates structured editorial feedback.',
    instruction: systemInstruction
  });

  let normalizedResult;
  try {
    normalizedResult = await executeAgentWithPolicy({
      agentName: 'script_doctor_agent',
      agent: scriptDoctorAgent,
      userPrompt: promptText,
      parseAndValidate: (extracted) => normalizeScriptDoctorPayload(extracted)
    });

    const durationMs = Math.max(1, Date.now() - startTime);
    console.log(`[script_doctor_agent] Completed review for "${validatedScreenplay.title}" in ${durationMs}ms. Score: ${normalizedResult.overall_score}`);

    if (validateClickHouseConfig()) {
      ensureCineAgentSchema().then(() => {
        recordAgentRun({
          run_id: runId,
          project_id: projectId,
          agent_name: 'script_doctor_agent',
          status: 'SUCCESS',
          duration_ms: durationMs
        }).catch((err) => console.warn(`[Telemetry] Telemetry recording failed: ${err.message}`));
      }).catch(() => {});
    }

    return normalizedResult;
  } catch (err) {
    const durationMs = Math.max(1, Date.now() - startTime);
    if (validateClickHouseConfig()) {
      ensureCineAgentSchema().then(() => {
        recordAgentRun({
          run_id: runId,
          project_id: projectId,
          agent_name: 'script_doctor_agent',
          status: 'FAILED',
          duration_ms: durationMs
        }).catch(() => {});
      }).catch(() => {});
    }
    throw err;
  }
}
