import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ProductionBreakdownSchema } from './breakdownAgent.js';
import { BudgetOutputSchema } from './budgetAgent.js';
import { getGeminiModel, executeAgentWithPolicy } from '../config/geminiConfig.js';

dotenv.config();

// Input Schema for Schedule Agent accepting production breakdown and optional budget
export const ScheduleInputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  target_shoot_days: z.number().int().positive('target_shoot_days must be a positive integer.').optional(),
  production_breakdown: ProductionBreakdownSchema,
  budget: BudgetOutputSchema.optional()
});

// Shooting Day Schema
export const ShootingDaySchema = z.object({
  shooting_day: z.number().int().positive('shooting_day must be a positive integer.'),
  date_label: z.string().trim().min(1, 'date_label cannot be empty.'),
  location: z.string().trim().min(1, 'location cannot be empty.'),
  time_of_day: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'OTHER'], {
    errorMap: () => ({ message: 'time_of_day must be DAY, NIGHT, DAWN, DUSK, or OTHER.' })
  }),
  scenes: z.array(z.number().int().positive()).min(1, 'At least one scene must be scheduled per shooting day.'),
  cast: z.array(z.string()),
  extras_count: z.number().int().nonnegative('extras_count must be a non-negative integer.'),
  estimated_day_cost: z.number().nonnegative('estimated_day_cost must be a non-negative number.'),
  setup_notes: z.string().trim().min(1, 'setup_notes cannot be empty.'),
  rationale: z.string().trim().min(1, 'rationale cannot be empty.'),
  risks: z.array(z.string())
});

export { ShootingDaySchema as DayPlanSchema };

// Schedule Optimization Summary Schema
export const ScheduleOptimizationSummarySchema = z.object({
  locations_consolidated: z.number().int().nonnegative(),
  night_blocks: z.number().int().nonnegative(),
  estimated_location_moves: z.number().int().nonnegative(),
  estimated_shoot_days: z.number().int().positive(),
  scheduling_notes: z.string().trim().min(1, 'scheduling_notes cannot be empty.')
});

export { ScheduleOptimizationSummarySchema as OptimizationSummarySchema };

// Complete Schedule Output Schema
export const ScheduleOutputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  total_shoot_days: z.number().int().positive('total_shoot_days must be a positive integer.'),
  days: z.array(ShootingDaySchema).min(1, 'Schedule must contain at least 1 shooting day.'),
  optimization_summary: ScheduleOptimizationSummarySchema,
  assumptions: z.array(z.string())
});

/**
 * Validates schedule fidelity against input production breakdown and budget.
 * Enforces scene coverage equality (every breakdown scene assigned exactly once).
 * @param {object} breakdown Production breakdown source of truth
 * @param {object|undefined} budget Budget source of truth
 * @param {object} schedule Generated schedule payload
 * @returns {boolean} True if valid
 */
export function validateScheduleFidelity(breakdown, budget, schedule) {
  if (!breakdown || !schedule) {
    throw new Error('Schedule validation failed: Missing breakdown or schedule payload.');
  }

  if (schedule.project_id !== breakdown.project_id) {
    throw new Error(`Schedule validation failed: project_id "${schedule.project_id}" does not match Breakdown project_id "${breakdown.project_id}".`);
  }

  if (schedule.title.toLowerCase().trim() !== breakdown.title.toLowerCase().trim()) {
    throw new Error(`Schedule validation failed: title "${schedule.title}" does not match breakdown title "${breakdown.title}".`);
  }

  if (schedule.total_shoot_days !== schedule.days.length) {
    throw new Error(`Schedule validation failed: total_shoot_days (${schedule.total_shoot_days}) does not match days array length (${schedule.days.length}).`);
  }

  const breakdownScenes = breakdown.scenes.map(s => s.scene_number);
  const scheduledScenes = schedule.days.flatMap(d => d.scenes);

  const seenScenes = new Set();
  for (const sNum of scheduledScenes) {
    if (seenScenes.has(sNum)) {
      throw new Error(`Schedule validation failed: Duplicate scene assignment. Scene ${sNum} is scheduled multiple times.`);
    }
    seenScenes.add(sNum);
  }

  for (const bNum of breakdownScenes) {
    if (!seenScenes.has(bNum)) {
      throw new Error(`Schedule validation failed: Scene count mismatch. Scene ${bNum} from breakdown is missing in the schedule.`);
    }
  }

  for (let i = 0; i < schedule.days.length; i++) {
    const day = schedule.days[i];
    if (day.shooting_day !== i + 1) {
      throw new Error(`Schedule validation failed: Non-sequential shooting day (${day.shooting_day}) at day index ${i}.`);
    }
  }

  return true;
}

/**
 * Executes the Schedule Agent against a validated Production Breakdown & Budget.
 * @param {object} input Container with breakdown, budget, target_shoot_days
 * @returns {Promise<object>} Validated ScheduleOutputSchema object
 */
export async function runScheduleAgent(input) {
  const startTime = Date.now();

  if (!input || !input.production_breakdown) {
    throw new Error('Schedule Agent failed: Valid production_breakdown must be provided.');
  }

  const validatedInput = ScheduleInputSchema.parse({
    project_id: input.project_id || input.production_breakdown.project_id,
    title: input.title || input.production_breakdown.title,
    target_shoot_days: input.target_shoot_days ? Number(input.target_shoot_days) : undefined,
    production_breakdown: input.production_breakdown,
    budget: input.budget
  });

  const systemInstruction = `
    You are an expert film Production Schedule Agent for CineAgent Studio.
    Your task is to analyze a Production Breakdown (and optional Budget) to generate an optimized, realistic production shooting schedule.

    OPTIMIZATION CRITERIA:
    1. LOCATION CONSOLIDATION: Group scenes shot in the same location on consecutive shooting days to minimize company moves.
    2. RESPECT TIME OF DAY (DAY/NIGHT): Group night shoots into continuous night blocks to avoid costly crew turnaround flips.
    3. CAST LOAD EFFICIENCY: Group scenes requiring the same principal cast members to minimize actor hold/call days.
    4. RESPECT SETUP & COMPLEXITY: Group scenes with complex rigs together.
    5. BUDGET AWARENESS: Consider scene costs and equipment needs when structuring the day plan.
    6. SCENE COVERAGE: Every scene from the breakdown must appear in the schedule EXACTLY ONCE. No missing scenes, no duplicates.
    7. TARGET SHOOT DAYS: If target_shoot_days is provided (${validatedInput.target_shoot_days || 'calculated realistically'}), aim for that target while maintaining realistic schedule pacing.
    8. CONCISE PRODUCTION RATIONALE: Each shooting day must explain the scheduling logic concisely in 'rationale'.

    Output MUST be a single raw valid JSON object adhering strictly to this schema:
    {
      "project_id": "${validatedInput.project_id}",
      "title": "${validatedInput.title}",
      "total_shoot_days": number (positive integer, equal to days.length),
      "days": [
        {
          "shooting_day": number (1, 2, 3...),
          "date_label": "Day 1",
          "location": "LOCATION NAME",
          "time_of_day": "NIGHT" | "DAY" | "DAWN" | "DUSK",
          "scenes": [scene_numbers],
          "cast": ["CHARACTER_NAME"],
          "extras_count": number,
          "estimated_day_cost": number,
          "setup_notes": "Key equipment and technical setup required for the day",
          "rationale": "Clear production reason why these scenes are grouped on this day",
          "risks": ["Specific production risks, e.g., weather delay, night turnaround"]
        }
      ],
      "optimization_summary": {
        "locations_consolidated": number,
        "night_blocks": number,
        "estimated_location_moves": number,
        "estimated_shoot_days": number,
        "scheduling_notes": "Summary of overall schedule efficiency"
      },
      "assumptions": ["Key scheduling assumptions"]
    }

    CRITICAL RULES:
    - Output ONLY valid raw JSON. Do NOT wrap in markdown code blocks (\`\`\`json).
    - Every breakdown scene must be assigned exactly once.
  `;

  const agent = new LlmAgent({
    name: 'schedule_agent',
    model: getGeminiModel(),
    description: 'Generates optimized production shooting schedules for film projects.',
    systemInstruction
  });

  const userPrompt = `
Generate the production shooting schedule for this project:

Project ID: ${validatedInput.project_id}
Title: ${validatedInput.title}
Target Shoot Days: ${validatedInput.target_shoot_days ? validatedInput.target_shoot_days : 'Auto-calculate based on breakdown'}

PRODUCTION BREAKDOWN:
${JSON.stringify(validatedInput.production_breakdown, null, 2)}

PROJECT BUDGET:
${validatedInput.budget ? JSON.stringify(validatedInput.budget, null, 2) : 'N/A'}
`;

  const parsedPayload = await executeAgentWithPolicy({
    agentName: 'schedule_agent',
    agent,
    userPrompt,
    parseAndValidate: (extracted) => {
      const validatedOutput = ScheduleOutputSchema.parse(extracted);
      validateScheduleFidelity(validatedInput.production_breakdown, validatedInput.budget, validatedOutput);
      return validatedOutput;
    }
  });

  const durationMs = Date.now() - startTime;
  return {
    ...parsedPayload,
    telemetry: {
      runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: parsedPayload.project_id,
      agentName: 'schedule_agent',
      durationMs
    }
  };
}
