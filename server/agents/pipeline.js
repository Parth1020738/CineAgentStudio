import { runStoryAgent, StoryOutputSchema } from './storyAgent.js';
import { runScreenplayAgent, ScreenplayInputSchema } from './screenplayAgent.js';

/**
 * Maps structured Story Agent output and concept inputs to valid Screenplay Agent input contract.
 * @param {object} storyPackage Output from Story Agent
 * @param {object} conceptInputs Original user concept inputs (title, genre, tone, etc.)
 * @returns {object} Validated ScreenplayInputSchema object
 */
export function mapStoryToScreenplayInput(storyPackage, conceptInputs = {}) {
  if (!storyPackage) {
    throw new Error('Handoff failed: Story Agent output is null or undefined.');
  }

  // Ensure Story Agent output conforms to StoryOutputSchema
  const validatedStory = StoryOutputSchema.parse(storyPackage);

  const title = conceptInputs.title || storyPackage.title;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Handoff failed: Film title is required for Screenplay Agent input.');
  }

  const projectId = conceptInputs.projectId || 
    (storyPackage.telemetry && storyPackage.telemetry.projectId) || 
    title.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const mappedInput = {
    projectId,
    title: title.trim(),
    logline: validatedStory.logline,
    genre: conceptInputs.genre || 'N/A',
    tone: conceptInputs.tone || 'N/A',
    synopsis: validatedStory.synopsis,
    three_act_structure: validatedStory.three_act_structure,
    characters: validatedStory.characters
  };

  // Validate against ScreenplayInputSchema
  return ScreenplayInputSchema.parse(mappedInput);
}

/**
 * Verifies story continuity and character alignment between Story Package and generated Screenplay.
 * @param {object} storyPackage Story Agent output
 * @param {object} screenplay Output from Screenplay Agent
 * @param {object} conceptInputs Initial concept options
 * @returns {boolean} True if continuity checks pass, throws Error otherwise.
 */
export function validatePipelineContinuity(storyPackage, screenplay, conceptInputs = {}) {
  if (!storyPackage || !screenplay) {
    throw new Error('Continuity check failed: Missing story or screenplay payload.');
  }

  const expectedTitle = conceptInputs.title || storyPackage.title;
  if (expectedTitle && screenplay.title.toLowerCase().trim() !== expectedTitle.toLowerCase().trim()) {
    throw new Error(`Continuity failure: Screenplay title "${screenplay.title}" does not match story title "${expectedTitle}".`);
  }

  // Verify at least one character from story package appears in the screenplay
  const storyCharNames = storyPackage.characters.map(c => c.name.toLowerCase());
  let characterMatchFound = false;

  for (const scene of screenplay.scenes) {
    for (const d of scene.dialogue) {
      if (storyCharNames.some(name => d.character.toLowerCase().includes(name) || name.includes(d.character.toLowerCase()))) {
        characterMatchFound = true;
        break;
      }
    }
    if (characterMatchFound) break;
  }

  if (!characterMatchFound) {
    // Check if character names appear in scene action blocks as fallback
    for (const scene of screenplay.scenes) {
      if (storyCharNames.some(name => scene.action.toLowerCase().includes(name))) {
        characterMatchFound = true;
        break;
      }
    }
  }

  if (!characterMatchFound) {
    throw new Error('Continuity failure: None of the characters defined in the Story Package were found in the Screenplay scenes.');
  }

  return true;
}

/**
 * Executes the real Multi-Agent Production Pipeline: Story Agent -> Adapter -> Screenplay Agent -> Validation.
 * @param {object} conceptInputs Intake options (title, genre, logline, tone, targetBudget)
 * @returns {Promise<object>} Pipeline result container
 */
export async function runStoryToScreenplayPipeline(conceptInputs) {
  const pipelineStartTime = Date.now();

  if (!conceptInputs || !conceptInputs.title) {
    throw new Error('Pipeline error: conceptInputs with a valid title must be provided.');
  }

  // 1. Execute REAL Story Agent
  console.log(`[Pipeline] Step 1: Executing Story Agent for "${conceptInputs.title}"...`);
  const storyPackage = await runStoryAgent(conceptInputs);
  
  if (!storyPackage || !storyPackage.logline) {
    throw new Error('Pipeline error: Story Agent failed to return a valid story package.');
  }

  // 2. Map Story output to Screenplay input
  console.log('[Pipeline] Step 2: Mapping Story Agent output to Screenplay Agent contract...');
  const screenplayInput = mapStoryToScreenplayInput(storyPackage, conceptInputs);

  // 3. Execute REAL Screenplay Agent
  console.log(`[Pipeline] Step 3: Executing Screenplay Agent for project "${screenplayInput.projectId}"...`);
  const screenplayStartTime = Date.now();
  const screenplayOutput = await runScreenplayAgent(screenplayInput);
  const screenplayDurationMs = Date.now() - screenplayStartTime;

  // 4. Verify Continuity
  console.log('[Pipeline] Step 4: Validating Story -> Screenplay continuity...');
  validatePipelineContinuity(storyPackage, screenplayOutput, conceptInputs);

  const totalDurationMs = Date.now() - pipelineStartTime;
  console.log(`[Pipeline] Multi-Agent Pipeline completed successfully in ${totalDurationMs}ms.`);

  return {
    storyPackage,
    screenplay: screenplayOutput,
    pipelineTelemetry: {
      storyDurationMs: storyPackage.telemetry ? storyPackage.telemetry.durationMs : 0,
      screenplayDurationMs,
      totalDurationMs,
      status: 'SUCCESS'
    }
  };
}
