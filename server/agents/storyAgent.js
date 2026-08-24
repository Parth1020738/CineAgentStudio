import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { recordAgentRun, validateClickHouseConfig, ensureCineAgentSchema } from '../mcp/clickhouseMcp.js';
import { getGeminiModel, executeAgentWithPolicy, extractJsonFromText } from '../config/geminiConfig.js';

dotenv.config();

// Helper function for ADK -> ClickHouse MCP endpoint & unit tests
export async function runAdkWithClickHouseMcp(projectId = 'test_project') {
  if (!validateClickHouseConfig()) {
    throw new Error('ClickHouse configuration missing in environment.');
  }
  await ensureCineAgentSchema();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await recordAgentRun({
    runId,
    projectId,
    agentName: 'story_agent',
    status: 'SUCCESS',
    durationMs: 1250
  });
  return { status: 'success', runId, projectId, message: 'Recorded ADK run to ClickHouse via MCP.' };
}

// Export extractJsonFromText for backward compatibility in tests
export { extractJsonFromText };

// Input Schema for Story Agent intake
export const StoryInputSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty.'),
  genre: z.string().trim().min(1, 'Genre cannot be empty.'),
  logline: z.string().trim().min(1, 'Logline cannot be empty.'),
  tone: z.string().optional().default('Engaging'),
  targetBudget: z.string().optional().default('5000000'),
  targetShootDays: z.string().optional().default('15'),
  projectId: z.string().optional()
});

// Output Schema definitions for Three-Act Structure, Character, and complete Story Package
export const ThreeActStructureSchema = z.object({
  act1: z.string().trim().min(1, 'Act 1 summary cannot be empty.'),
  act2: z.string().trim().min(1, 'Act 2 summary cannot be empty.'),
  act3: z.string().trim().min(1, 'Act 3 summary cannot be empty.')
});

export const CharacterSchema = z.object({
  name: z.string().trim().min(1, 'Character name cannot be empty.'),
  role: z.string().trim().min(1, 'Character role cannot be empty.'),
  description: z.string().trim().min(1, 'Character description cannot be empty.')
});

export const StoryOutputSchema = z.object({
  project_id: z.string().optional().default('default_project'),
  title: z.string().optional().default('Untitled Project'),
  logline: z.string().trim().min(1, 'Logline cannot be empty.'),
  genre: z.string().optional().default('Drama'),
  tone: z.string().optional().default('Engaging'),
  synopsis: z.string().trim().min(1, 'Synopsis cannot be empty.'),
  three_act_structure: ThreeActStructureSchema,
  characters: z.array(CharacterSchema).min(1, 'At least one character is required.')
});

/**
 * Deterministic normalizer for Story Agent payloads.
 * Maps unambiguous field aliases without fabricating content.
 * @param {object} rawJson Raw JSON object
 * @returns {object} Normalized object ready for StoryOutputSchema validation
 */
export function normalizeStoryPayload(rawJson) {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Story Agent output must be a valid JSON object.');
  }

  const safeString = (val, fallback = '') => {
    if (val == null) return fallback;
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
  };

  const normalized = {};

  normalized.project_id = safeString(rawJson.project_id || rawJson.projectId || (rawJson.title ? safeString(rawJson.title).toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_project'));
  normalized.title = safeString(rawJson.title, 'Untitled Project');
  normalized.logline = safeString(rawJson.logline || rawJson.premise || rawJson.summary);
  normalized.genre = safeString(rawJson.genre, 'Drama');
  normalized.tone = safeString(rawJson.tone, 'Engaging');
  normalized.synopsis = safeString(rawJson.synopsis || rawJson.summary || rawJson.logline);

  // Map three_act_structure aliases
  const raw3Act = rawJson.three_act_structure || rawJson.threeActStructure || {};
  normalized.three_act_structure = {
    act1: safeString(raw3Act.act1 || raw3Act.act_1 || raw3Act.Act1),
    act2: safeString(raw3Act.act2 || raw3Act.act_2 || raw3Act.Act2),
    act3: safeString(raw3Act.act3 || raw3Act.act_3 || raw3Act.Act3)
  };

  // Map characters array aliases
  const rawChars = Array.isArray(rawJson.characters) ? rawJson.characters : (Array.isArray(rawJson.cast) ? rawJson.cast : []);
  normalized.characters = rawChars.map((c) => ({
    name: safeString(c?.name || c?.character || c?.characterName),
    role: safeString(c?.role || c?.type || c?.characterType, 'Supporting'),
    description: safeString(c?.description || c?.bio || c?.details)
  })).filter(c => c.name.length > 0);

  return normalized;
}

// Standalone core LlmAgent without MCP tool dependency for high-speed generation
export const storyAgent = new LlmAgent({
  name: 'story_agent',
  model: getGeminiModel(),
  instruction: `
    You are an expert Story Concept Agent for CineAgent Studio.
    Your task is to analyze initial film intake concepts and produce a structured, high-concept Story Package JSON.

    STRICT OUTPUT CONTRACT:
    Output MUST be a single valid, parseable raw JSON object matching this schema:
    {
      "project_id": "string",
      "title": "string",
      "logline": "string",
      "genre": "string",
      "tone": "string",
      "synopsis": "Detailed narrative synopsis of the film.",
      "three_act_structure": {
        "act1": "Detailed summary of Setup & Inciting Incident.",
        "act2": "Detailed summary of Rising Action & Midpoint Crisis.",
        "act3": "Detailed summary of Climax & Resolution."
      },
      "characters": [
        {
          "name": "Character Name",
          "role": "Protagonist / Antagonist / Supporting",
          "description": "Character background and arc."
        }
      ]
    }

    Strict Quality & Formatting Rules:
    1. Output MUST be pure raw JSON ONLY (no markdown backticks, no code fences, no conversational text).
    2. All fields MUST be populated with non-empty, high quality narrative details.
    3. Ensure character roles match typical dramatic archetypes.
  `,
  description: 'Generates structured story packages including three-act structure and character profiles.'
});

/**
 * Executes the Story Agent pipeline using Google ADK and Gemini API.
 * @param {object} input Intake options matching StoryInputSchema
 * @returns {Promise<object>} The validated JSON story package result with telemetry metadata
 */
export async function runStoryAgent(input) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const validatedInput = StoryInputSchema.parse(input);
  const projectId = validatedInput.projectId || validatedInput.title.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const userPrompt = `Generate a structured Story Package for the film concept below.

Title: ${validatedInput.title}
Genre: ${validatedInput.genre}
Logline Idea: ${validatedInput.logline}
Tone: ${validatedInput.tone}
Target Budget: ${validatedInput.targetBudget}

Return ONLY the raw JSON object matching the requested schema.`;

  let parsedPayload;
  try {
    parsedPayload = await executeAgentWithPolicy({
      agentName: 'story_agent',
      agent: storyAgent,
      userPrompt,
      parseAndValidate: (extracted) => {
        const normalized = normalizeStoryPayload(extracted);
        return StoryOutputSchema.parse(normalized);
      }
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    if (validateClickHouseConfig()) {
      try {
        await ensureCineAgentSchema();
        await recordAgentRun({
          runId,
          projectId,
          agentName: 'story_agent',
          status: 'FAILED',
          durationMs
        });
      } catch (mcpErr) {
        // ignore telemetry write error
      }
    }
    throw err;
  }

  const durationMs = Date.now() - startTime;

  // Log telemetry to ClickHouse Cloud via MCP run_query if configured
  if (validateClickHouseConfig()) {
    try {
      await ensureCineAgentSchema();
      await recordAgentRun({
        runId,
        projectId,
        agentName: 'story_agent',
        status: 'SUCCESS',
        durationMs
      });
      console.log(`[Telemetry] Recorded Story Agent run ${runId} to ClickHouse Cloud via MCP.`);
    } catch (mcpError) {
      console.warn('[Telemetry] Failed to record run to ClickHouse Cloud via MCP:', mcpError.message);
    }
  }

  return {
    ...parsedPayload,
    telemetry: {
      runId,
      projectId,
      agentName: 'story_agent',
      durationMs
    }
  };
}
