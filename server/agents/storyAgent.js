import { LlmAgent, Runner } from '@google/adk';
import { z } from 'zod';

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

// Configure the Story Agent with instructions and constraints
export const storyAgent = new LlmAgent({
  name: 'story_agent',
  // Using official ADK/Gemini model identifier
  model: 'gemini-1.5-flash',
  instruction: `
    You are an expert Story Agent.
    Your task is to generate a comprehensive story package in JSON format based on the user's film concept inputs.
    
    Inputs:
    - Title: {title}
    - Genre: {genre}
    - Logline Idea: {logline_idea}
    - Tone: {tone}
    - Target Budget: {target_budget}
    
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
  description: 'Generates structured film story loglines, synopses, character details, and 3-act structures.'
});

/**
 * Executes the Story Agent pipeline.
 * @param {object} inputs Intake options
 * @returns {Promise<object>} The validated JSON story result
 */
export async function runStoryAgent(inputs) {
  const runner = new Runner({ agent: storyAgent });
  
  // Format the instruction arguments
  const userPrompt = `Generate a story package for the film:
Title: ${inputs.title}
Genre: ${inputs.genre}
Logline Idea: ${inputs.logline}
Tone: ${inputs.tone}
Target Budget: ${inputs.targetBudget}`;

  let fullResponseText = '';
  
  // Iterate through runAsync stream output
  for await (const chunk of runner.runAsync({
    newMessage: {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  })) {
    if (chunk.type === 'text' || chunk.text) {
      fullResponseText += chunk.text;
    }
  }

  // Extract JSON payload from text response blocks
  const jsonMatch = fullResponseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Agent failed to return a valid JSON structure.');
  }

  const parsedJson = JSON.parse(jsonMatch[0]);
  return StoryOutputSchema.parse(parsedJson);
}
