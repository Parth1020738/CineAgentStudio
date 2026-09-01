import dotenv from 'dotenv';
import { getDemoProductionPlan } from '../server/fixtures/demoFixtures.js';
import { breakdownAgent } from '../server/agents/breakdownAgent.js';
import { extractJsonFromText, getGeminiModel } from '../server/config/geminiConfig.js';
import { LlmAgent, InMemoryRunner } from '@google/adk';

dotenv.config();

async function runRawAgent(agent, userPrompt) {
  const runner = new InMemoryRunner({ agent });
  const session = await runner.sessionService.createSession({ appName: runner.appName, userId: 'diag' });

  let text = '';
  for await (const event of runner.runAsync({
    sessionId: session.id,
    userId: 'diag',
    newMessage: { role: 'user', parts: [{ text: userPrompt }] }
  })) {
    if (event.content && event.content.parts) {
      for (const part of event.content.parts) {
        if (part.text) text += part.text;
      }
    }
  }
  return text;
}

function analyzeOutput(text) {
  if (!text || text.trim().length === 0) return 'empty response';
  
  const isFenced = text.includes('```');
  const extracted = extractJsonFromText(text);

  let type = 'raw JSON';
  if (isFenced) type = 'fenced JSON';
  else if (text.trim().startsWith('{') && text.trim().endsWith('}')) type = 'plain JSON';
  else if (extracted) type = 'prose + JSON';

  let topLevelKeys = [];
  if (extracted && typeof extracted === 'object') {
    topLevelKeys = Object.keys(extracted);
  }

  return {
    type,
    extractedSuccessfully: Boolean(extracted),
    topLevelKeys,
    sampleSnippet: text.substring(0, 150).replace(/\s+/g, ' ')
  };
}

async function main() {
  const demo = getDemoProductionPlan();

  console.log('=== DIAGNOSING BREAKDOWN AGENT ===');
  const breakdownPrompt = `Perform a detailed production breakdown for the following screenplay:

Project ID: ${demo.storyPackage.project_id}
Title: ${demo.storyPackage.title}

Screenplay JSON:
${JSON.stringify(demo.screenplay, null, 2)}

Return the Production Breakdown JSON.`;

  const rawBreakdownText = await runRawAgent(breakdownAgent, breakdownPrompt);
  const bdDiag = analyzeOutput(rawBreakdownText);
  console.log('Breakdown Agent Diagnostic:', JSON.stringify(bdDiag, null, 2));

  console.log('\n=== DIAGNOSING SCHEDULE AGENT ===');
  const scheduleAgent = new LlmAgent({
    name: 'schedule_agent',
    model: getGeminiModel(),
    instruction: 'Generate film production shooting schedules in JSON.'
  });

  const schedulePrompt = `Generate the production shooting schedule for this project:

Project ID: ${demo.storyPackage.project_id}
Title: ${demo.storyPackage.title}
Target Shoot Days: 3

PRODUCTION BREAKDOWN:
${JSON.stringify(demo.breakdown, null, 2)}

PROJECT BUDGET:
${JSON.stringify(demo.budget, null, 2)}

IMPORTANT: Respond ONLY with a single raw JSON object matching the requested schema.`;

  const rawScheduleText = await runRawAgent(scheduleAgent, schedulePrompt);
  const schedDiag = analyzeOutput(rawScheduleText);
  console.log('Schedule Agent Diagnostic:', JSON.stringify(schedDiag, null, 2));
}

main();
