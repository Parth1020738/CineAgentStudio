import { z } from 'zod';

// Input Schema for Scenario Simulation
export const WhatIfScenarioInputSchema = z.object({
  targetShootDays: z.number().int('Target shoot days must be an integer.').positive('Target shoot days must be a positive integer.'),
  targetBudget: z.number().positive('Target budget must be a positive number.')
});

// Output Schema for Scenario Simulation Result
export const WhatIfScenarioOutputSchema = z.object({
  scenario_id: z.string().min(1),
  scenario_type: z.enum(['shoot_days', 'budget', 'combined']),
  baseline: z.object({
    budget: z.number().nonnegative(),
    shoot_days: z.number().int().positive(),
    scene_count: z.number().int().nonnegative(),
    location_count: z.number().int().nonnegative(),
    night_scene_count: z.number().int().nonnegative()
  }),
  target: z.object({
    budget: z.number().nonnegative(),
    shoot_days: z.number().int().positive()
  }),
  deltas: z.object({
    budget_delta: z.number(),
    budget_variance_pct: z.number(),
    shoot_days_delta: z.number(),
    days_compression_pct: z.number()
  }),
  affected_scenes: z.array(z.number().int().positive()),
  affected_locations: z.array(z.string().trim().min(1)),
  cost_pressure_categories: z.array(
    z.object({
      category: z.string(),
      current_cost: z.number(),
      status: z.string(),
      note: z.string()
    })
  ),
  tradeoffs: z.array(z.string().trim().min(1)),
  risks: z.array(z.string().trim().min(1)),
  assumptions: z.array(z.string().trim().min(1))
});

/**
 * Deterministically calculates what-if scenario trade-offs from existing production data.
 * DOES NOT CALL GEMINI LLM.
 * DOES NOT OVERWRITE CANONICAL PLAN.
 * @param {object} params Object containing breakdown, budget, schedule, targetShootDays, targetBudget
 * @returns {object} Validated scenario output object
 */
export function simulateWhatIfScenario({ breakdown, budget, schedule, targetShootDays, targetBudget }) {
  if (!breakdown || typeof breakdown !== 'object') throw new Error('Valid breakdown object is required.');
  if (!budget || typeof budget !== 'object') throw new Error('Valid budget object is required.');
  if (!schedule || typeof schedule !== 'object') throw new Error('Valid schedule object is required.');

  // Validate numeric inputs
  const parsedInputs = WhatIfScenarioInputSchema.parse({
    targetShootDays: Number(targetShootDays),
    targetBudget: Number(targetBudget)
  });

  const baselineBudget = Number(budget.estimated_total || budget.target_budget || 0);
  const baselineDays = Number(schedule.total_shoot_days || (Array.isArray(schedule.days) ? schedule.days.length : 1));
  const scenes = Array.isArray(breakdown.scenes) ? breakdown.scenes : [];
  const sceneCount = scenes.length;
  
  const locations = Array.from(new Set(scenes.map(s => s.location).filter(Boolean)));
  const locationCount = locations.length;

  const nightScenes = scenes.filter(s => String(s.time_of_day || s.time || '').toUpperCase().includes('NIGHT'));
  const nightSceneCount = nightScenes.length;

  const reqDays = parsedInputs.targetShootDays;
  const reqBudget = parsedInputs.targetBudget;

  const daysDelta = reqDays - baselineDays;
  const daysCompressionPct = baselineDays > 0 ? Math.round(((baselineDays - reqDays) / baselineDays) * 100) : 0;

  const budgetDelta = reqBudget - baselineBudget;
  const budgetVariancePct = baselineBudget > 0 ? Number((((reqBudget - baselineBudget) / baselineBudget) * 100).toFixed(1)) : 0;

  let affectedSceneNumbers = [];
  let affectedLocationsList = [];
  let tradeoffs = [];
  let risks = [];
  let assumptions = [];

  let scenarioType = 'combined';
  if (daysDelta !== 0 && budgetDelta === 0) scenarioType = 'shoot_days';
  if (daysDelta === 0 && budgetDelta !== 0) scenarioType = 'budget';

  // Schedule Compression / Extension Analysis
  if (daysDelta < 0) {
    const compressedDaysCount = Math.abs(daysDelta);
    const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [];
    const tailDays = scheduleDays.slice(-compressedDaysCount);
    
    tailDays.forEach(day => {
      if (Array.isArray(day.scenes)) {
        day.scenes.forEach(sc => {
          const num = typeof sc === 'object' ? sc.scene_number : sc;
          if (typeof num === 'number' && !affectedSceneNumbers.includes(num)) {
            affectedSceneNumbers.push(num);
          }
        });
      }
    });

    if (affectedSceneNumbers.length === 0) {
      affectedSceneNumbers = scenes.map(s => s.scene_number).filter(Boolean).slice(-2);
    }

    affectedLocationsList = Array.from(new Set(
      scenes.filter(s => affectedSceneNumbers.includes(s.scene_number)).map(s => s.location).filter(Boolean)
    ));

    tradeoffs.push(`Compressing schedule by ${compressedDaysCount} day(s) requires combining ${affectedSceneNumbers.length} scene(s) into remaining shooting days.`);
    tradeoffs.push(`Higher daily setup density: Average scenes per day increases from ${(sceneCount / (baselineDays || 1)).toFixed(1)} to ${(sceneCount / (reqDays || 1)).toFixed(1)}.`);
    
    risks.push('Overtime Risk: Longer daily shooting hours increase crew fatigue and potential overtime rates.');
    risks.push('Company Move Pressure: Potential multi-location moves within single shooting days.');

    assumptions.push(`Assumes crew overtime capacity is available on remaining ${reqDays} shoot day(s).`);
    assumptions.push('Assumes location permits allow extended daily shooting windows.');
  } else if (daysDelta > 0) {
    tradeoffs.push(`Extending schedule by ${daysDelta} day(s) lowers daily scene load to ${(sceneCount / (reqDays || 1)).toFixed(1)} scenes/day.`);
    tradeoffs.push('Allows more setup time per scene for enhanced lighting and camera movement.');

    risks.push(`Daily Day-Rate Expansion: Adds gear rental and crew day-rate costs for ${daysDelta} extra day(s).`);

    assumptions.push('Assumes key cast and equipment rental availability for extended timeline.');
  } else {
    tradeoffs.push(`Shoot days match baseline schedule (${baselineDays} days).`);
  }

  // Budget Reduction / Extension Analysis
  const costCategories = Array.isArray(budget.categories) ? budget.categories : [];
  const costPressureCategories = costCategories.map(cat => {
    const cost = Number(cat.estimated_cost || 0);
    let status = 'Baseline';
    let note = cat.explanation || 'Standard allocation';

    if (budgetDelta < 0) {
      if (['Equipment', 'VFX', 'Location', 'Production Design', 'Extras'].some(k => (cat.category || '').toLowerCase().includes(k.toLowerCase()))) {
        status = 'Potential reduction area';
        note = 'Requires producer review for scope or vendor rate renegotiation';
      }
    }
    return {
      category: cat.category || 'General',
      current_cost: cost,
      status,
      note
    };
  });

  if (budgetDelta < 0) {
    tradeoffs.push(`Target budget requires $${Math.abs(budgetDelta).toLocaleString()} (${Math.abs(budgetVariancePct)}%) reduction against current baseline.`);
    risks.push('Budget Compression: Risk of compromising production quality or requiring scene scope scalebacks.');
    assumptions.push('Requires line-by-line producer renegotiation of non-essential budget categories.');
  } else if (budgetDelta > 0) {
    tradeoffs.push(`Target budget adds $${budgetDelta.toLocaleString()} (+${budgetVariancePct}%) contingency buffer over baseline.`);
    assumptions.push('Additional funds allocated to contingency and production polish.');
  }

  if (tradeoffs.length === 0) tradeoffs.push('No significant trade-offs identified for baseline parameters.');
  if (risks.length === 0) risks.push('Low operational risk: parameters match current baseline plan.');
  if (assumptions.length === 0) assumptions.push('Standard production parameters apply.');

  const scenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const result = {
    scenario_id: scenarioId,
    scenario_type: scenarioType,
    baseline: {
      budget: baselineBudget,
      shoot_days: baselineDays,
      scene_count: sceneCount,
      location_count: locationCount,
      night_scene_count: nightSceneCount
    },
    target: {
      budget: reqBudget,
      shoot_days: reqDays
    },
    deltas: {
      budget_delta: budgetDelta,
      budget_variance_pct: budgetVariancePct,
      shoot_days_delta: daysDelta,
      days_compression_pct: daysCompressionPct
    },
    affected_scenes: affectedSceneNumbers,
    affected_locations: affectedLocationsList,
    cost_pressure_categories: costPressureCategories,
    tradeoffs,
    risks,
    assumptions
  };

  return WhatIfScenarioOutputSchema.parse(result);
}
