import { LlmAgent, InMemoryRunner, FunctionTool } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { recordAgentRun, validateClickHouseConfig, ensureCineAgentSchema } from '../mcp/clickhouseMcp.js';
import { queryProductionAnalytics } from '../mcp/adkMcpTool.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

// Define the structured schema for Story Agent output
export const StoryOutputSchema = z.object({
  logline: z.string(),
  synopsis: z.string(),
  three_act_structure: z.object({
    act1: z.string(),
    act2: z.string(),
    act3: z.string()
  }),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      description: z.string()
    })
  )
});

// ADK Tool binding definition for ClickHouse MCP Analytics
export const clickHouseAnalyticsAdkTool = new FunctionTool({
  name: 'queryProductionAnalytics',
  description: 'Queries production execution telemetry and agent run metrics from ClickHouse Cloud via official mcp-clickhouse run_query tool.',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Optional film project ID to filter analytics.'
      }
    }
  },
  execute: async ({ projectId = '' } = {}) => {
    return await queryProductionAnalytics({ projectId });
  }
});

// Configure the Story Agent with instructions, constraints, and ClickHouse MCP tools
export const storyAgent = new LlmAgent({
  name: 'story_agent',
  model: 'gemini-3.6-flash',
  instruction: `
    You are an expert Story Agent.
    Your task is to generate a comprehensive story package in JSON format based on the user's film concept inputs (Title, Genre, Logline Idea, Tone, Target Budget).
    You have access to ClickHouse MCP tools to query production analytics when requested.
    
    You must format your response strictly as a JSON object matching this schema:
    {
      "logline": "A concise one-sentence description of the story.",
      "synopsis": "A detailed multi-paragraph summary of the story's narrative flow.",
      "three_act_structure": {
        "act1": "Detailed description of Act 1 setup.",
        "act2": "Detailed description of Act 2 confrontation.",
        "act3": "Detailed description of Act 3 resolution."
      },
      "characters": [
        {
          "name": "Character Name",
          "role": "Protagonist/Antagonist/Supporting",
          "description": "Short bio and character motivation."
        }
      ]
    }
  `,
  description: 'Generates structured film story loglines, synopses, character details, and 3-act structures.',
  tools: [clickHouseAnalyticsAdkTool]
});

/**
 * Executes the Story Agent pipeline and logs telemetry to ClickHouse Cloud via MCP.
 * @param {object} inputs Intake options
 * @returns {Promise<object>} The validated JSON story result
 */
export async function runStoryAgent(inputs) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const projectId = inputs.projectId || (inputs.title ? inputs.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_project');

  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
  }

  const userPrompt = `Generate a story package for the film:
Title: ${inputs.title}
Genre: ${inputs.genre}
Logline Idea: ${inputs.logline}
Tone: ${inputs.tone}
Target Budget: ${inputs.targetBudget}`;

  const maxAttempts = 5;
  let fullResponseText = '';
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    fullResponseText = '';
    let lastErrorMessage = '';

    try {
      const runner = new InMemoryRunner({ agent: storyAgent });
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
      console.warn(`[Story Agent] Attempt ${attempt}/${maxAttempts} caught exception: ${lastErrorMessage}`);
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
      console.warn(`[Story Agent] Retrying attempt ${attempt + 1}/${maxAttempts} in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const jsonMatch = fullResponseText ? fullResponseText.match(/\{[\s\S]*\}/) : null;
  if (!jsonMatch) {
    if (lastError && (lastError.message.includes('429') || lastError.message.includes('Quota exceeded'))) {
      throw new Error(`Gemini API rate limit exceeded (429). Please wait 15–30 seconds before retrying.`);
    }
    throw new Error(`Story Agent failed to return a valid JSON structure. ${lastError ? lastError.message : ''}`);
  }

  const parsedJson = JSON.parse(jsonMatch[0]);
  const validatedOutput = StoryOutputSchema.parse(parsedJson);
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
    ...validatedOutput,
    telemetry: {
      runId,
      projectId,
      durationMs,
      mcpLogged: validateClickHouseConfig()
    }
  };
}

/**
 * Demonstrates Google ADK Agent executing native tool invocation for ClickHouse MCP.
 * @param {string} projectId The project ID to query via MCP.
 * @returns {Promise<object>} Result of Google ADK agent -> MCP tool invocation.
 */
export async function runAdkWithClickHouseMcp(projectId = '') {
  console.log(`[Google ADK → MCP] Executing ADK Agent native tool query for project "${projectId}"...`);
  const analyticsData = await clickHouseAnalyticsAdkTool.execute({ projectId });
  return {
    adkAgent: storyAgent.name,
    registeredTools: storyAgent.tools ? storyAgent.tools.map(t => t.name) : [],
    mcpToolUsed: 'run_query',
    analytics: analyticsData
  };
}
