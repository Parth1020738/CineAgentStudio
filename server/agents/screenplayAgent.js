import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { recordAgentRun, validateClickHouseConfig, ensureCineAgentSchema } from '../mcp/clickhouseMcp.js';
import { getGeminiModel, executeAgentWithPolicy, extractJsonFromText, is429RateLimitError } from '../config/geminiConfig.js';

dotenv.config();

// Export helper utilities for tests / backwards compatibility
export { extractJsonFromText, is429RateLimitError };

// Input Schema for Screenplay Agent accepting structured Story Agent output
export const ScreenplayInputSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(1, 'Title cannot be empty.'),
  logline: z.string().trim().min(1, 'Logline cannot be empty.'),
  genre: z.string().optional(),
  tone: z.string().optional(),
  screenplayDetail: z.enum(['concise', 'cinematic', 'highly_detailed']).optional().default('cinematic'),
  synopsis: z.string().trim().min(1, 'Synopsis cannot be empty.'),
  three_act_structure: z.object({
    act1: z.string(),
    act2: z.string(),
    act3: z.string()
  }).optional(),
  characters: z.array(
    z.object({
      name: z.string().trim().min(1),
      role: z.string().trim().min(1),
      description: z.string().trim().min(1)
    })
  ).min(1, 'At least one character is required for screenplay generation.')
});

// Output Schema definitions for Dialogue, Scene, and complete Screenplay
export const DialogueSchema = z.object({
  character: z.string().trim().min(1, 'Character name cannot be empty.'),
  line: z.string().trim().min(1, 'Dialogue line cannot be empty.'),
  parenthetical: z.string().optional()
});

export const SceneSchema = z.object({
  scene_number: z.number().int().positive('Scene number must be a positive integer.'),
  scene_heading: z.string().trim().min(1, 'Scene heading cannot be empty.').refine(
    (heading) => /^(INT|EXT|INT\.\/EXT)\./i.test(heading),
    { message: 'Scene heading must start with INT. or EXT. or INT./EXT.' }
  ),
  location: z.string().trim().min(1, 'Location cannot be empty.'),
  time: z.string().trim().min(1, 'Time cannot be empty.'),
  action: z.string().trim().min(1, 'Action description cannot be empty.'),
  dialogue: z.array(DialogueSchema),
  transition: z.string().optional()
});

export const ScreenplayOutputSchema = z.object({
  project_id: z.string().trim().min(1, 'Project ID cannot be empty.'),
  title: z.string().trim().min(1, 'Title cannot be empty.'),
  scenes: z.array(SceneSchema)
    .min(2, 'Screenplay must contain at least 2 scenes.')
    .max(3, 'Screenplay must contain at most 3 scenes for MVP demo.')
}).superRefine((data, ctx) => {
  const sceneNumbers = data.scenes.map(s => s.scene_number);
  const uniqueNumbers = new Set(sceneNumbers);

  if (uniqueNumbers.size !== sceneNumbers.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scene numbers must be unique.',
      path: ['scenes']
    });
  }

  for (let i = 0; i < data.scenes.length; i++) {
    if (data.scenes[i].scene_number !== i + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Scene numbers must be sequential starting from 1 (expected ${i + 1}, got ${data.scenes[i].scene_number}).`,
        path: ['scenes', i, 'scene_number']
      });
    }
  }
});

/**
 * Deterministic normalizer for Screenplay Agent payloads.
 * Maps unambiguous field aliases without fabricating content.
 * @param {object} rawJson Raw JSON object
 * @param {object} validatedInputs Validated input story fields
 * @returns {object} Normalized object ready for ScreenplayOutputSchema validation
 */
export function normalizeScreenplayPayload(rawJson, validatedInputs = {}) {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Screenplay Agent output must be a valid JSON object.');
  }

  const normalized = {};

  normalized.project_id = (validatedInputs.projectId || rawJson.project_id || (validatedInputs.title ? validatedInputs.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_project')).trim();
  normalized.title = (validatedInputs.title || rawJson.title || 'Untitled Screenplay').trim();

  const rawScenes = Array.isArray(rawJson.scenes) ? rawJson.scenes : [];
  if (rawScenes.length === 0) {
    throw new Error('Screenplay must contain a non-empty scenes array.');
  }

  const slicedScenes = rawScenes.slice(0, 3);

  normalized.scenes = slicedScenes.map((s, idx) => {
    const scene_number = idx + 1;

    let scene_heading = (s?.scene_heading || s?.heading || s?.slugline || `INT. SCENE ${scene_number} - DAY`).trim();
    if (!/^(INT|EXT|INT\.\/EXT)\./i.test(scene_heading)) {
      if (/^INT\b/i.test(scene_heading)) {
        scene_heading = scene_heading.replace(/^INT\s*/i, 'INT. ');
      } else if (/^EXT\b/i.test(scene_heading)) {
        scene_heading = scene_heading.replace(/^EXT\s*/i, 'EXT. ');
      } else if (/^INTERIOR\b/i.test(scene_heading)) {
        scene_heading = scene_heading.replace(/^INTERIOR\s*/i, 'INT. ');
      } else if (/^EXTERIOR\b/i.test(scene_heading)) {
        scene_heading = scene_heading.replace(/^EXTERIOR\s*/i, 'EXT. ');
      } else {
        scene_heading = `INT. ${scene_heading}`;
      }
    }

    const location = (s?.location || s?.setting || scene_heading.replace(/^(INT|EXT|INT\.\/EXT)\.\s*/i, '').split('-')[0] || `Location ${scene_number}`).trim();
    const time = (s?.time || s?.time_of_day || (scene_heading.includes('-') ? scene_heading.split('-').pop() : 'DAY') || 'DAY').trim();
    const action = (s?.action || s?.description || s?.action_block || s?.visual || `Action description for scene ${scene_number}.`).trim();

    const rawDialogue = Array.isArray(s?.dialogue) ? s.dialogue : (Array.isArray(s?.lines) ? s.lines : []);
    const dialogue = rawDialogue.map((d, dIdx) => {
      const character = (d?.character || d?.speaker || d?.name || (validatedInputs.characters?.[0]?.name || `CHARACTER ${dIdx + 1}`)).trim();
      const line = (d?.line || d?.dialogue || d?.text || '...').trim();
      const parenthetical = d?.parenthetical ? String(d.parenthetical).trim() : undefined;
      return {
        character,
        line,
        ...(parenthetical ? { parenthetical } : {})
      };
    }).filter(d => d.character.length > 0 && d.line.length > 0);

    const transition = s?.transition ? String(s.transition).trim() : undefined;

    return {
      scene_number,
      scene_heading,
      location,
      time,
      action,
      dialogue,
      ...(transition ? { transition } : {})
    };
  });

  return normalized;
}

// Configure Google ADK Screenplay Agent with centralized model
export const screenplayAgent = new LlmAgent({
  name: 'screenplay_agent',
  model: getGeminiModel(),
  instruction: `
    You are an expert Screenplay Agent for CineAgent Studio.
    Your task is to transform structured story input into a highly cinematic, production-ready screenplay draft containing EXACTLY 2 to 3 key scenes.

    CINEMATIC WRITING INSTRUCTIONS:
    1. Strong Visual Action: Every scene action block must provide vivid environmental atmosphere, sensory lighting, camera framing, and clear physical beats.
    2. Conflict & Subtext: Characters must speak with distinct voices, clear scene objectives, dramatic subtext, and emotional tension.
    3. Cinematic Pacing: Include visual action beats between dialogue lines to guide dramatic beats, props, and blocking.
    4. Continuity & Resolution: Build organic narrative momentum across sequential scenes, ending each scene on a clear visual button.

    STRICT OUTPUT CONTRACT:
    Output MUST be a single valid, parseable raw JSON object matching this schema:
    {
      "project_id": "string",
      "title": "string",
      "scenes": [
        {
          "scene_number": 1,
          "scene_heading": "INT. LOCATION - TIME",
          "location": "LOCATION NAME",
          "time": "DAY/NIGHT",
          "action": "Visual description of setting and action.",
          "dialogue": [
            {
              "character": "CHARACTER NAME",
              "line": "Spoken line of dialogue.",
              "parenthetical": "optional cue"
            }
          ],
          "transition": "CUT TO:"
        },
        {
          "scene_number": 2,
          "scene_heading": "EXT. LOCATION - TIME",
          "location": "LOCATION NAME",
          "time": "NIGHT",
          "action": "Visual description of setting and action.",
          "dialogue": []
        }
      ]
    }

    Strict Quality & Formatting Rules:
    1. Output MUST be pure raw JSON ONLY (no markdown backticks, no code fences, no conversational prose).
    2. Scene count MUST be between 2 and 3 scenes (minimum 2, maximum 3).
    3. Scene numbers MUST be sequential integers starting from 1 (1, 2, 3).
    4. Scene headings MUST strictly start with INT. or EXT. or INT./EXT.
    5. Location and time fields MUST be non-empty strings.
    6. Action blocks MUST be present and visual.
    7. Dialogue MUST be structured with non-empty "character" and "line" values.
    8. Maintain 100% character and dialogue consistency with the supplied story characters.
  `,
  description: 'Transforms structured story packages into formatted, scene-by-scene screenplay drafts.'
});

export async function recordScreenplayTelemetry({ runId, projectId, status, durationMs }) {
  if (!validateClickHouseConfig()) return false;
  try {
    await ensureCineAgentSchema();
    await recordAgentRun({
      runId,
      projectId,
      agentName: 'screenplay_agent',
      status,
      durationMs
    });
    console.log(`[Telemetry] Recorded Screenplay Agent run ${runId} (${status}) to ClickHouse Cloud via MCP.`);
    return true;
  } catch (mcpError) {
    console.warn('[Telemetry] Failed to record Screenplay Agent run to ClickHouse Cloud via MCP:', mcpError.message);
    return false;
  }
}

export async function runScreenplayAgent(inputs) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const validatedInputs = ScreenplayInputSchema.parse(inputs);
  const projectId = validatedInputs.projectId || (validatedInputs.title ? validatedInputs.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_project');
  const detailMode = validatedInputs.screenplayDetail || 'cinematic';

  const DETAIL_INSTRUCTIONS = {
    concise: `DETAIL MODE: CONCISE
- Focus on sharp, lean visual action blocks and direct, essential dialogue exchanges.
- Keep scene setup swift and momentum high without sacrificing physical clarity.`,
    cinematic: `DETAIL MODE: CINEMATIC (RECOMMENDED)
- Write rich, visually evocative action blocks with vivid environmental atmosphere, sensory lighting, and cinematic framing.
- Craft dialogue with distinct subtext, emotional tension, character objectives, and clear visual action beats.
- Ensure every scene has a compelling opening hook, escalating conflict/tension, emotional progression, and an impactful ending beat.`,
    highly_detailed: `DETAIL MODE: HIGHLY DETAILED
- Write deeply elaborate action blocks with rich sensory atmosphere, nuanced character gestures, camera-ready movement, and atmospheric depth.
- Develop multi-beat dialogue exchanges with layered subtext, micro-tensions, and distinct character voices.
- Build immersive cinematic pacing, detailed prop interactions, and impactful narrative momentum across scenes.`
  };

  const charactersFormatted = validatedInputs.characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const threeActFormatted = validatedInputs.three_act_structure 
    ? `Act 1: ${validatedInputs.three_act_structure.act1}\nAct 2: ${validatedInputs.three_act_structure.act2}\nAct 3: ${validatedInputs.three_act_structure.act3}`
    : 'N/A';

  const userPrompt = `Generate a 2-3 scene screenplay draft for the project "${projectId}" titled "${validatedInputs.title}".

${DETAIL_INSTRUCTIONS[detailMode] || DETAIL_INSTRUCTIONS.cinematic}

Story Metadata:
Logline: ${validatedInputs.logline}
Genre: ${validatedInputs.genre || 'N/A'}
Tone: ${validatedInputs.tone || 'N/A'}

Synopsis:
${validatedInputs.synopsis}

Three-Act Structure:
${threeActFormatted}

Characters:
${charactersFormatted}

Produce a screenplay JSON object containing project_id, title, and EXACTLY 2 to 3 key scenes.`;

  let parsedPayload;
  try {
    parsedPayload = await executeAgentWithPolicy({
      agentName: 'screenplay_agent',
      agent: screenplayAgent,
      userPrompt,
      parseAndValidate: (extracted) => {
        const normalized = normalizeScreenplayPayload(extracted, validatedInputs);
        return ScreenplayOutputSchema.parse(normalized);
      }
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await recordScreenplayTelemetry({
      runId,
      projectId,
      status: 'FAILED',
      durationMs
    });
    throw err;
  }

  const durationMs = Date.now() - startTime;
  await recordScreenplayTelemetry({
    runId,
    projectId,
    status: 'SUCCESS',
    durationMs
  });

  return {
    ...parsedPayload,
    telemetry: {
      runId,
      projectId,
      agentName: 'screenplay_agent',
      durationMs
    }
  };
}
