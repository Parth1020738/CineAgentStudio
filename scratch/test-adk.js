import { LlmAgent, InMemoryRunner, stringifyContent } from '@google/adk';
import { z } from 'zod';

const StoryOutputSchema = z.object({
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

const storyAgent = new LlmAgent({
  name: 'story_agent',
  model: 'gemini-2.5-flash',
  instruction: 'You are an expert film Story Agent.',
  outputSchema: StoryOutputSchema,
  disallowTransferToParent: true,
  disallowTransferToPeers: true
});

console.log('LlmAgent created successfully:', storyAgent.name);

const runner = new InMemoryRunner({ agent: storyAgent });
console.log('InMemoryRunner created successfully.');
