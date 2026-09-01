import dotenv from 'dotenv';
import { runStoryAgent } from '../server/agents/storyAgent.js';
import { runScreenplayAgent } from '../server/agents/screenplayAgent.js';
import { runBreakdownAgent } from '../server/agents/breakdownAgent.js';
import { runBudgetAgent } from '../server/agents/budgetAgent.js';
import { runScheduleAgent } from '../server/agents/scheduleAgent.js';
import { mapStoryToScreenplayInput, runFullProductionPipeline } from '../server/agents/pipeline.js';

dotenv.config();

async function main() {
  const uniqueId = `real_test_${Date.now()}`;
  console.log('Using unique project ID:', uniqueId);

  // 1. Generate real Story & Screenplay
  console.log('\n--- Step 1: Real Story & Screenplay ---');
  const storyRes = await runStoryAgent({
    projectId: uniqueId,
    title: 'Cyberpunk Odyssey',
    genre: 'Sci-Fi',
    logline: 'A cyberpunk thriller about a rogue hacker uncovering AI secrets.'
  });
  console.log('Story Agent SUCCESS:', storyRes.title);

  const screenplayInput = mapStoryToScreenplayInput(storyRes, { projectId: uniqueId, title: storyRes.title });
  const screenplayRes = await runScreenplayAgent(screenplayInput);
  console.log('Screenplay Agent SUCCESS. Scene count:', screenplayRes.scenes.length);

  // 2. PART 10: Single Real Breakdown Test
  console.log('\n--- PART 10: Single Real Breakdown Test ---');
  const breakdownRes = await runBreakdownAgent({
    project_id: uniqueId,
    title: storyRes.title,
    screenplay: screenplayRes
  });

  console.log('Breakdown scenes count:', breakdownRes.scenes.length);
  console.log('Breakdown title:', breakdownRes.title);
  console.log('Breakdown project_id:', breakdownRes.project_id);

  if (
    breakdownRes.scenes &&
    breakdownRes.scenes.length === screenplayRes.scenes.length &&
    breakdownRes.title === storyRes.title &&
    breakdownRes.project_id === uniqueId
  ) {
    console.log('BREAKDOWN_REAL_TEST = PASS');
  } else {
    console.error('BREAKDOWN_REAL_TEST = FAIL');
    process.exit(1);
  }

  // 3. Generate Budget
  console.log('\n--- Step 3: Real Budget Agent ---');
  const budgetRes = await runBudgetAgent({
    project_id: uniqueId,
    title: storyRes.title,
    production_breakdown: breakdownRes
  });
  console.log('Budget Agent SUCCESS. Total:', budgetRes.estimated_total);

  // 4. PART 11: Single Real Schedule Test
  console.log('\n--- PART 11: Single Real Schedule Test ---');
  const scheduleRes = await runScheduleAgent({
    project_id: uniqueId,
    title: storyRes.title,
    production_breakdown: breakdownRes,
    budget: budgetRes
  });

  console.log('Schedule days count:', scheduleRes.days.length);
  console.log('Schedule total_shoot_days:', scheduleRes.total_shoot_days);
  console.log('Schedule title:', scheduleRes.title);
  console.log('Schedule project_id:', scheduleRes.project_id);

  if (
    scheduleRes.total_shoot_days >= 1 &&
    scheduleRes.days.length >= 1 &&
    scheduleRes.title.toLowerCase().trim() === storyRes.title.toLowerCase().trim() &&
    scheduleRes.project_id === uniqueId
  ) {
    console.log('SCHEDULE_REAL_TEST = PASS');
  } else {
    console.error('SCHEDULE_REAL_TEST = FAIL');
    process.exit(1);
  }

  // 5. PART 12: Full Live Production Pipeline
  console.log('\n--- PART 12: Complete Live Production Pipeline ---');
  const pipelineRes = await runFullProductionPipeline({
    projectId: `full_pipeline_${Date.now()}`,
    title: 'Neon Odyssey',
    genre: 'Cyberpunk',
    logline: 'A detective investigates an AI breach in futuristic Tokyo.'
  });

  console.log('Full Pipeline SUCCESS!');
  console.log('Pipeline project title:', pipelineRes.storyPackage.title);
  console.log('FULL_PIPELINE = PASS');
}

main().catch((err) => {
  console.error('REAL TEST FAILED:', err.message || err);
  process.exit(1);
});
