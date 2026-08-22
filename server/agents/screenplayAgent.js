import { LlmAgent, InMemoryRunner } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { recordAgentRun, validateClickHouseConfig, ensureCineAgentSchema } from '../mcp/clickhouseMcp.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

// Input Schema for Screenplay Agent accepting structured Story Agent output
export const ScreenplayInputSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(1, 'Title cannot be empty.'),
  logline: z.string().trim().min(1, 'Logline cannot be empty.'),
  genre: z.string().optional(),
  tone: z.string().optional(),
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

  // Validate scene number uniqueness
  if (uniqueNumbers.size !== sceneNumbers.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Scene numbers must be unique.',
      path: ['scenes']
    });
  }

  // Validate sequential 1-based scene numbering
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

// Configure Google ADK Screenplay Agent
export const screenplayAgent = new LlmAgent({
  name: 'screenplay_agent',
  model: 'gemini-3.6-flash',
  instruction: `
    You are an expert Screenplay Agent for CineAgent Studio.
    Your task is to transform structured story input (title, logline, synopsis, characters, 3-act structure) into a concise, production-ready screenplay draft containing EXACTLY 2 to 3 key scenes suitable for film production.

    Strict Quality & Formatting Rules:
    1. Output MUST be formatted strictly as a single valid JSON object matching the requested schema.
    2. Scene count MUST be between 2 and 3 scenes (minimum 2, maximum 3).
    3. Scene numbers MUST be sequential integers starting from 1 (e.g., scene 1, scene 2, scene 3).
    4. Scene headings MUST strictly start with INT. or EXT. or INT./EXT. (e.g., "INT. WORKSHOP - NIGHT", "EXT. ALLEYWAY - DAY"). Never use generic headings like "Scene 1".
    5. Location and time fields MUST be non-empty strings corresponding directly to the scene heading.
    6. Action blocks MUST be present, visual, present-tense, and describe concrete character movements and setting details.
    7. Dialogue MUST be structured with non-empty "character" and "line" values. Action-only scenes with empty dialogue arrays are permitted where appropriate.
    8. Maintain 100% character and dialogue consistency with the supplied story characters. Do NOT invent new major characters unless strictly necessary.
    9. Preserve narrative continuity and tone established in the input story.

    JSON Schema Format:
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
              "parenthetical": "optional emotional cue"
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
  `,
  description: 'Transforms structured story packages into formatted, scene-by-scene screenplay drafts.'
});

/**
 * Helper function to record Screenplay Agent run telemetry to ClickHouse Cloud via MCP.
 * @param {object} params Telemetry fields (runId, projectId, status, durationMs)
 */
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

/**
 * Executes the Screenplay Agent pipeline using Google ADK and Gemini API.
 * @param {object} inputs Intake options matching ScreenplayInputSchema
 * @returns {Promise<object>} The validated JSON screenplay result with telemetry metadata
 */
export async function runScreenplayAgent(inputs) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const validatedInputs = ScreenplayInputSchema.parse(inputs);
  const projectId = validatedInputs.projectId || (validatedInputs.title ? validatedInputs.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_project');

  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
  }

  const charactersFormatted = validatedInputs.characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const threeActFormatted = validatedInputs.three_act_structure 
    ? `Act 1: ${validatedInputs.three_act_structure.act1}\nAct 2: ${validatedInputs.three_act_structure.act2}\nAct 3: ${validatedInputs.three_act_structure.act3}`
    : 'N/A';

  const userPrompt = `Generate a 2-3 scene screenplay draft for the project "${projectId}" titled "${validatedInputs.title}".

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

  const maxAttempts = 5;
  let fullResponseText = '';
  let lastError = null;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      fullResponseText = '';
      let lastErrorMessage = '';

      try {
        const runner = new InMemoryRunner({ agent: screenplayAgent });
        const session = await runner.sessionService.createSession({ appName: runner.appName, userId: 'default' });

        for await (const event of runner.runAsync({
          sessionId: session.id,
          userId: 'default',
          newMessage: {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        })) {
          if (event.errorMessage) {
            lastErrorMessage = event.errorMessage;
          }
          if (event.content && event.content.parts) {
            for (const part of event.content.parts) {
              if (part.text) {
                fullResponseText += part.text;
              }
            }
          }
        }

        if (!fullResponseText) {
          const updatedSession = await runner.sessionService.getSession({ appName: runner.appName, userId: 'default', sessionId: session.id });
          const modelEvents = updatedSession.events ? updatedSession.events.filter(e => e.author !== 'user' && e.content && e.content.parts) : [];
          for (const event of modelEvents) {
            for (const part of event.content.parts) {
              if (part.text) {
                fullResponseText += part.text;
              }
            }
          }
        }
      } catch (err) {
        lastError = err;
        lastErrorMessage = err.message || String(err);
        console.warn(`[Screenplay Agent] Attempt ${attempt}/${maxAttempts} caught exception: ${lastErrorMessage}`);
      }

      if (fullResponseText && fullResponseText.includes('{')) {
        break; // Valid text received
      }

      const isRateLimited = lastErrorMessage && (
        lastErrorMessage.includes('Quota exceeded') ||
        lastErrorMessage.includes('429') ||
        lastErrorMessage.includes('RESOURCE_EXHAUSTED')
      );

      if (attempt < maxAttempts) {
        const delayMs = isRateLimited ? 15000 : 3000;
        console.warn(`[Screenplay Agent] Retrying attempt ${attempt + 1}/${maxAttempts} in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const jsonMatch = fullResponseText ? fullResponseText.match(/\{[\s\S]*\}/) : null;
    if (!jsonMatch) {
      if (lastError && (lastError.message.includes('429') || lastError.message.includes('Quota exceeded'))) {
        throw new Error(`Gemini API rate limit exceeded (429). Please wait 15–30 seconds before retrying.`);
      }
      throw new Error(`Screenplay Agent failed to return a valid JSON structure. ${lastError ? lastError.message : ''}`);
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    
    // Enforce project_id matching if missing or generic
    if (!parsedJson.project_id) {
      parsedJson.project_id = projectId;
    }
    if (!parsedJson.title) {
      parsedJson.title = validatedInputs.title;
    }

    // Validate against Screenplay Output Schema
    const validatedOutput = ScreenplayOutputSchema.parse(parsedJson);
    const durationMs = Date.now() - startTime;

    // Log SUCCESS telemetry to ClickHouse Cloud via MCP run_query if configured
    await recordScreenplayTelemetry({
      runId,
      projectId,
      status: 'SUCCESS',
      durationMs
    });

    return {
      ...validatedOutput,
      telemetry: {
        runId,
        projectId,
        agentName: 'screenplay_agent',
        durationMs,
        mcpLogged: validateClickHouseConfig()
      }
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    // Log FAILED telemetry to ClickHouse Cloud via MCP run_query if configured
    await recordScreenplayTelemetry({
      runId,
      projectId,
      status: 'FAILED',
      durationMs
    });
    throw error;
  }
}
