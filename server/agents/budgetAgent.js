import { LlmAgent, InMemoryRunner } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { ProductionBreakdownSchema } from './breakdownAgent.js';
import { getGeminiModel, executeAgentWithPolicy } from '../config/geminiConfig.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

// Input Schema for Budget Agent
export const BudgetInputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  target_budget: z.number().nonnegative('target_budget must be a non-negative number.').optional().nullable(),
  production_breakdown: ProductionBreakdownSchema
});

// Category Budget Schema
export const CategoryBudgetSchema = z.object({
  category: z.enum([
    'CAST',
    'CREW',
    'LOCATIONS',
    'EQUIPMENT',
    'PRODUCTION_DESIGN',
    'WARDROBE_MAKEUP',
    'TRANSPORT',
    'VFX_SFX',
    'PROPS',
    'CONTINGENCY'
  ], {
    errorMap: () => ({ message: 'Invalid budget category.' })
  }),
  estimated_cost: z.number().nonnegative('category estimated_cost must be non-negative.'),
  explanation: z.string().trim().min(1, 'explanation cannot be empty.')
});

// Scene Cost Entry Schema
export const SceneCostSchema = z.object({
  scene_number: z.number().int().positive('scene_number must be a positive integer.'),
  scene_heading: z.string().trim().min(1, 'scene_heading cannot be empty.'),
  estimated_cost: z.number().nonnegative('scene estimated_cost must be non-negative.'),
  major_cost_drivers: z.array(z.string())
});

// Major Cost Driver Schema
export const MajorCostDriverSchema = z.object({
  factor: z.string().trim().min(1, 'factor cannot be empty.'),
  impact: z.number().nonnegative('impact cost must be non-negative.'),
  explanation: z.string().trim().min(1, 'explanation cannot be empty.')
});

// Cost Saving Recommendation Schema
export const CostRecommendationSchema = z.object({
  recommendation: z.string().trim().min(1, 'recommendation cannot be empty.'),
  potential_savings: z.number().nonnegative('potential_savings must be non-negative.'),
  rationale: z.string().trim().min(1, 'rationale cannot be empty.')
});

// Budget Reconciliation Hardening Schema
export const BudgetReconciliationSchema = z.object({
  scene_linked_cost_total: z.number().nonnegative('scene_linked_cost_total must be non-negative.'),
  project_wide_cost_total: z.number().nonnegative('project_wide_cost_total must be non-negative.'),
  contingency_cost: z.number().nonnegative('contingency_cost must be non-negative.'),
  estimated_total: z.number().nonnegative('estimated_total must be non-negative.'),
  explanation: z.string().trim().min(1, 'explanation cannot be empty.')
});

// Budget Output Schema
export const BudgetOutputSchema = z.object({
  project_id: z.string().trim().min(1, 'project_id is required.'),
  title: z.string().trim().min(1, 'title is required.'),
  target_budget: z.number().nonnegative().optional().nullable(),
  estimated_total: z.number().nonnegative('estimated_total must be non-negative.'),
  budget_status: z.enum(['UNDER_TARGET', 'AT_TARGET', 'OVER_TARGET', 'TARGET_NOT_SPECIFIED'], {
    errorMap: () => ({ message: 'Invalid budget_status.' })
  }),
  budget_variance: z.number().optional().nullable(),
  categories: z.array(CategoryBudgetSchema).min(1, 'At least one budget category is required.'),
  scene_costs: z.array(SceneCostSchema).min(1, 'At least one scene_cost is required.'),
  major_cost_drivers: z.array(MajorCostDriverSchema),
  recommendations: z.array(CostRecommendationSchema),
  assumptions: z.array(z.string()),
  budget_reconciliation: BudgetReconciliationSchema
});

/**
 * Validates safe numeric value without producing NaN.
 * @param {any} val Value to parse
 * @param {number|undefined} defaultVal Default fallback value if val cannot be parsed
 * @returns {number|undefined} Parsed number or default
 */
export function parseSafeNumber(val, defaultVal = undefined) {
  if (typeof val === 'number' && !isNaN(val)) {
    return val;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[\$,\s]/g, '');
    const num = Number(cleaned);
    if (!isNaN(num)) {
      return num;
    }
  }
  return defaultVal;
}

/**
 * Validates budget reconciliation and fidelity against Production Breakdown source of truth.
 * @param {object} breakdown Validated Production Breakdown object
 * @param {object} budget Validated Budget object
 * @returns {boolean} True if reconciliation and fidelity checks pass, throws Error otherwise.
 */
export function validateBudgetFidelity(breakdown, budget) {
  if (!breakdown || !budget) {
    throw new Error('Budget validation failed: Missing breakdown or budget payload.');
  }

  if (budget.project_id !== breakdown.project_id) {
    throw new Error(`Budget validation failed: project_id "${budget.project_id}" does not match breakdown project_id "${breakdown.project_id}".`);
  }

  if (budget.title.toLowerCase().trim() !== breakdown.title.toLowerCase().trim()) {
    throw new Error(`Budget validation failed: title "${budget.title}" does not match breakdown title "${breakdown.title}".`);
  }

  if (!Array.isArray(budget.scene_costs) || budget.scene_costs.length !== breakdown.scenes.length) {
    throw new Error(`Budget validation failed: scene_costs count (${budget.scene_costs?.length}) does not match breakdown scene count (${breakdown.scenes.length}).`);
  }

  for (let i = 0; i < breakdown.scenes.length; i++) {
    const bdScene = breakdown.scenes[i];
    const bgScene = budget.scene_costs[i];

    if (bgScene.scene_number !== bdScene.scene_number) {
      throw new Error(`Budget validation failed at scene index ${i}: Budget scene_number (${bgScene.scene_number}) does not match breakdown scene_number (${bdScene.scene_number}).`);
    }

    if (bgScene.scene_heading.toLowerCase().trim() !== bdScene.scene_heading.toLowerCase().trim()) {
      throw new Error(`Budget validation failed at scene ${bdScene.scene_number}: Budget scene_heading "${bgScene.scene_heading}" does not match breakdown scene_heading "${bdScene.scene_heading}".`);
    }
  }

  // Budget Reconciliation Hardening Checks
  if (budget.budget_reconciliation) {
    const { scene_linked_cost_total, project_wide_cost_total, contingency_cost, estimated_total, explanation } = budget.budget_reconciliation;

    if (!explanation || explanation.trim().length === 0) {
      throw new Error('Budget validation failed: budget_reconciliation explanation cannot be empty.');
    }

    const sceneSum = budget.scene_costs.reduce((acc, sc) => acc + sc.estimated_cost, 0);
    if (scene_linked_cost_total !== sceneSum) {
      throw new Error(`Budget validation failed: scene_linked_cost_total ($${scene_linked_cost_total.toLocaleString()}) does not equal sum of scene_costs ($${sceneSum.toLocaleString()}).`);
    }

    const reconciliationSum = scene_linked_cost_total + project_wide_cost_total + contingency_cost;
    if (reconciliationSum !== estimated_total) {
      throw new Error(`Budget validation failed: scene_linked_cost_total ($${scene_linked_cost_total}) + project_wide_cost_total ($${project_wide_cost_total}) + contingency_cost ($${contingency_cost}) = $${reconciliationSum}, which does not equal estimated_total ($${estimated_total}).`);
    }
  }

  return true;
}

/**
 * Computes deterministic target budget status and variance.
 * @param {number} estimatedTotal Total estimated cost
 * @param {number|null} targetBudget Target budget
 * @returns {{ status: string, variance: number|null }} Status and variance
 */
export function calculateBudgetStatus(estimatedTotal, targetBudget) {
  if (targetBudget == null || isNaN(targetBudget) || targetBudget <= 0) {
    return { status: 'TARGET_NOT_SPECIFIED', variance: null };
  }

  const variance = estimatedTotal - targetBudget;
  let status = 'AT_TARGET';

  if (estimatedTotal < targetBudget * 0.98) {
    status = 'UNDER_TARGET';
  } else if (estimatedTotal > targetBudget * 1.02) {
    status = 'OVER_TARGET';
  }

  return { status, variance };
}

/**
 * Normalizes raw Budget Agent LLM responses into strict BudgetOutputSchema contract.
 * @param {object} rawJson Raw JSON object from Gemini
 * @param {object} validatedInput Validated budget input container
 * @returns {object} Normalized budget object ready for Zod validation
 */
export function normalizeBudgetPayload(rawJson, validatedInput) {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Budget Agent output must be a valid JSON object.');
  }

  const normalized = { ...rawJson };

  // 1. project_id & title
  normalized.project_id = (validatedInput.project_id || normalized.project_id || '').trim();
  normalized.title = (validatedInput.title || normalized.title || '').trim();

  // 2. target_budget
  normalized.target_budget = parseSafeNumber(normalized.target_budget, validatedInput.target_budget != null ? validatedInput.target_budget : null);

  // 3. scene_costs
  const bdScenes = validatedInput.production_breakdown.scenes || [];
  const rawSceneCosts = Array.isArray(normalized.scene_costs) ? normalized.scene_costs : [];

  normalized.scene_costs = bdScenes.map((bdScene, idx) => {
    const matchingRaw = rawSceneCosts.find(sc => sc && (sc.scene_number === bdScene.scene_number || sc.number === bdScene.scene_number)) || rawSceneCosts[idx] || {};

    const rawCost = matchingRaw.estimated_cost ?? matchingRaw.cost ?? matchingRaw.scene_cost ?? matchingRaw.amount ?? bdScene.estimated_cost;
    const parsedCost = parseSafeNumber(rawCost, bdScene.estimated_cost || 0);

    let drivers = [];
    if (Array.isArray(matchingRaw.major_cost_drivers)) {
      drivers = matchingRaw.major_cost_drivers.map(d => typeof d === 'string' ? d.trim() : (d?.factor || d?.name || String(d))).filter(Boolean);
    } else if (typeof matchingRaw.major_cost_drivers === 'string') {
      drivers = [matchingRaw.major_cost_drivers.trim()];
    }
    if (drivers.length === 0 && bdScene.complexity === 'HIGH') {
      drivers = [`Scene ${bdScene.scene_number} high complexity setups`];
    }

    return {
      scene_number: bdScene.scene_number,
      scene_heading: bdScene.scene_heading,
      estimated_cost: parsedCost,
      major_cost_drivers: drivers
    };
  });

  const sceneLinkedTotal = normalized.scene_costs.reduce((sum, sc) => sum + sc.estimated_cost, 0);

  // 4. categories
  const rawCategories = Array.isArray(normalized.categories) ? normalized.categories : [];
  const validCategoryEnums = [
    'CAST', 'CREW', 'LOCATIONS', 'EQUIPMENT', 'PRODUCTION_DESIGN',
    'WARDROBE_MAKEUP', 'TRANSPORT', 'VFX_SFX', 'PROPS', 'CONTINGENCY'
  ];

  const categoryMap = new Map();
  for (const rawCat of rawCategories) {
    if (!rawCat) continue;
    const rawName = String(rawCat.category || rawCat.name || '').toUpperCase().replace(/[\s\/\&-]+/g, '_').trim();
    let mappedCat = null;
    for (const validCat of validCategoryEnums) {
      if (rawName === validCat || rawName.includes(validCat) || validCat.includes(rawName)) {
        mappedCat = validCat;
        break;
      }
    }
    if (!mappedCat) {
      if (rawName.includes('ACTOR') || rawName.includes('TALENT')) mappedCat = 'CAST';
      else if (rawName.includes('CAMERA') || rawName.includes('GRIP') || rawName.includes('LIGHT')) mappedCat = 'EQUIPMENT';
      else if (rawName.includes('POST') || rawName.includes('EFFECT')) mappedCat = 'VFX_SFX';
      else if (rawName.includes('ART') || rawName.includes('SET')) mappedCat = 'PRODUCTION_DESIGN';
      else if (rawName.includes('TRAVEL')) mappedCat = 'TRANSPORT';
      else if (rawName.includes('HAIR') || rawName.includes('COSTUME')) mappedCat = 'WARDROBE_MAKEUP';
      else mappedCat = 'CREW';
    }

    const rawCost = rawCat.estimated_cost ?? rawCat.cost ?? rawCat.amount ?? rawCat.budget;
    const cost = parseSafeNumber(rawCost, 0);
    const explanation = (rawCat.explanation || rawCat.description || rawCat.notes || rawCat.rationale || `${mappedCat} budget allocation`).trim();

    if (!categoryMap.has(mappedCat)) {
      categoryMap.set(mappedCat, { category: mappedCat, estimated_cost: cost, explanation });
    } else {
      const existing = categoryMap.get(mappedCat);
      existing.estimated_cost += cost;
    }
  }

  if (categoryMap.size === 0) {
    categoryMap.set('CAST', { category: 'CAST', estimated_cost: Math.round(sceneLinkedTotal * 0.3), explanation: 'Talent compensation' });
    categoryMap.set('CREW', { category: 'CREW', estimated_cost: Math.round(sceneLinkedTotal * 0.35), explanation: 'Production crew' });
    categoryMap.set('LOCATIONS', { category: 'LOCATIONS', estimated_cost: Math.round(sceneLinkedTotal * 0.15), explanation: 'Location permits' });
    categoryMap.set('EQUIPMENT', { category: 'EQUIPMENT', estimated_cost: Math.round(sceneLinkedTotal * 0.1), explanation: 'Camera and lighting packages' });
    categoryMap.set('CONTINGENCY', { category: 'CONTINGENCY', estimated_cost: Math.round(sceneLinkedTotal * 0.1), explanation: 'Production risk buffer' });
  }

  normalized.categories = Array.from(categoryMap.values());

  // 5. major_cost_drivers (top-level)
  const rawDrivers = Array.isArray(normalized.major_cost_drivers) ? normalized.major_cost_drivers : [];
  normalized.major_cost_drivers = rawDrivers.map((d, i) => {
    if (typeof d === 'string') {
      return {
        factor: d.trim(),
        impact: Math.round(sceneLinkedTotal * 0.15),
        explanation: `Major cost factor: ${d.trim()}`
      };
    }
    const factor = (d?.factor || d?.name || d?.driver || d?.item || `Cost Factor ${i + 1}`).trim();
    const rawImpact = d?.impact ?? d?.impact_amount ?? d?.cost ?? d?.amount;
    const impact = parseSafeNumber(rawImpact, Math.round(sceneLinkedTotal * 0.1));
    const explanation = (d?.explanation || d?.rationale || d?.description || `High impact driver: ${factor}`).trim();
    return { factor, impact, explanation };
  }).filter(d => d.factor.length > 0);

  if (normalized.major_cost_drivers.length === 0) {
    const highScenes = bdScenes.filter(s => s.complexity === 'HIGH');
    normalized.major_cost_drivers = highScenes.map(s => ({
      factor: `${s.location} (${s.time_of_day})`,
      impact: s.estimated_cost || Math.round(sceneLinkedTotal * 0.2),
      explanation: s.production_notes || `High complexity shoot at ${s.location}`
    }));
    if (normalized.major_cost_drivers.length === 0) {
      normalized.major_cost_drivers = [{
        factor: 'Principal Production Logistics',
        impact: Math.round(sceneLinkedTotal * 0.15),
        explanation: 'Core crew, locations, and equipment allocations.'
      }];
    }
  }

  // 6. recommendations
  const rawRecs = Array.isArray(normalized.recommendations) ? normalized.recommendations :
    (Array.isArray(normalized.cost_saving_recommendations) ? normalized.cost_saving_recommendations : []);
  normalized.recommendations = rawRecs.map((r, i) => {
    if (typeof r === 'string') {
      return {
        recommendation: r.trim(),
        potential_savings: Math.round(sceneLinkedTotal * 0.05),
        rationale: 'Optimization to reduce rental and turnaround overhead.'
      };
    }
    const recommendation = (r?.recommendation || r?.title || r?.suggestion || `Recommendation ${i + 1}`).trim();
    const rawSavings = r?.potential_savings ?? r?.savings ?? r?.potentialSavings ?? r?.amount;
    const potential_savings = parseSafeNumber(rawSavings, 0);
    const rationale = (r?.rationale || r?.explanation || r?.description || 'Cost optimization opportunity').trim();
    return { recommendation, potential_savings, rationale };
  }).filter(r => r.recommendation.length > 0);

  if (normalized.recommendations.length === 0) {
    normalized.recommendations = [{
      recommendation: 'Group consecutive night scenes into continuous blocks',
      potential_savings: Math.round(sceneLinkedTotal * 0.05),
      rationale: 'Avoids costly equipment rental day holds and turnaround overtime.'
    }];
  }

  // 7. assumptions
  const rawAssumptions = Array.isArray(normalized.assumptions) ? normalized.assumptions :
    (Array.isArray(normalized.production_assumptions) ? normalized.production_assumptions : []);
  normalized.assumptions = rawAssumptions.map(a => typeof a === 'string' ? a.trim() : (a?.assumption || a?.text || JSON.stringify(a))).filter(Boolean);
  if (normalized.assumptions.length === 0) {
    normalized.assumptions = [
      'Principal photography scheduled within target shoot days.',
      'Standard 10% contingency included for unforeseen weather and operational overages.'
    ];
  }

  // 8. budget_reconciliation & estimated_total calculation
  const contingencyCategory = normalized.categories.find(c => c.category === 'CONTINGENCY');
  const rawContingency = normalized.budget_reconciliation?.contingency_cost ?? contingencyCategory?.estimated_cost;
  const contingencyCost = parseSafeNumber(rawContingency, Math.round(sceneLinkedTotal * 0.1));

  const rawEstimatedTotal = parseSafeNumber(normalized.estimated_total ?? normalized.budget_reconciliation?.estimated_total, null);
  const categoriesSum = normalized.categories.reduce((acc, c) => acc + c.estimated_cost, 0);

  let baselineTotal = rawEstimatedTotal != null && rawEstimatedTotal >= sceneLinkedTotal + contingencyCost
    ? rawEstimatedTotal
    : (categoriesSum >= sceneLinkedTotal + contingencyCost ? categoriesSum : sceneLinkedTotal + contingencyCost + Math.round(sceneLinkedTotal * 0.5));

  let projectWideTotal = baselineTotal - sceneLinkedTotal - contingencyCost;
  if (projectWideTotal < 0) {
    projectWideTotal = 0;
  }
  const exactEstimatedTotal = sceneLinkedTotal + projectWideTotal + contingencyCost;

  normalized.estimated_total = exactEstimatedTotal;

  // 9. budget_status & budget_variance
  const { status, variance } = calculateBudgetStatus(exactEstimatedTotal, normalized.target_budget);
  normalized.budget_status = status;
  normalized.budget_variance = variance;

  normalized.budget_reconciliation = {
    scene_linked_cost_total: sceneLinkedTotal,
    project_wide_cost_total: projectWideTotal,
    contingency_cost: contingencyCost,
    estimated_total: exactEstimatedTotal,
    explanation: (normalized.budget_reconciliation?.explanation ||
      `Strict reconciliation: Scene-linked costs ($${sceneLinkedTotal.toLocaleString()}) + Project-wide costs ($${projectWideTotal.toLocaleString()}) + Contingency ($${contingencyCost.toLocaleString()}) = Estimated Total ($${exactEstimatedTotal.toLocaleString()}).`).trim()
  };

  return normalized;
}

// Google ADK Budget Agent with centralized model
export const budgetAgent = new LlmAgent({
  name: 'budget_agent',
  model: getGeminiModel(),
  instruction: `
    You are an expert film Production Budget Agent for CineAgent Studio.
    Your task is to analyze a validated Production Breakdown JSON object and create a comprehensive, category-level and scene-level Project Production Budget JSON object.

    OUTPUT FORMAT MUST BE VALID RAW JSON ONLY MATCHING THIS EXACT SCHEMA:
    {
      "project_id": "string",
      "title": "string",
      "target_budget": number_or_null,
      "estimated_total": number,
      "categories": [
        {
          "category": "CAST",
          "estimated_cost": number,
          "explanation": "string"
        }
      ],
      "scene_costs": [
        {
          "scene_number": number,
          "scene_heading": "string",
          "estimated_cost": number,
          "major_cost_drivers": ["string"]
        }
      ],
      "major_cost_drivers": [
        {
          "factor": "string",
          "impact": number,
          "explanation": "string"
        }
      ],
      "recommendations": [
        {
          "recommendation": "string",
          "potential_savings": number,
          "rationale": "string"
        }
      ],
      "assumptions": ["string"],
      "budget_reconciliation": {
        "scene_linked_cost_total": number,
        "project_wide_cost_total": number,
        "contingency_cost": number,
        "estimated_total": number,
        "explanation": "string"
      }
    }

    Strict Output Rules:
    1. Output ONLY valid raw JSON (no markdown formatting, no code block backticks \`\`\`json).
    2. Set project_id and title EXACTLY as provided in the Production Breakdown.
    3. Standard category enums: CAST, CREW, LOCATIONS, EQUIPMENT, PRODUCTION_DESIGN, WARDROBE_MAKEUP, TRANSPORT, VFX_SFX, PROPS, CONTINGENCY.
    4. scene_costs must have exact scene count and matching scene_number and scene_heading from breakdown.
    5. Numeric values MUST be pure numbers, not strings or NaN.
    6. Exact reconciliation formula: scene_linked_cost_total + project_wide_cost_total + contingency_cost = estimated_total.
  `
});

/**
 * Executes the Budget Agent against a validated Production Breakdown.
 * @param {object} input Container with project_id, title, target_budget, and production_breakdown
 * @returns {Promise<object>} Validated BudgetOutputSchema object
 */
export async function runBudgetAgent(input) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!input || !input.production_breakdown) {
    throw new Error('Budget Agent failed: Valid production_breakdown must be provided.');
  }

  const validatedInput = BudgetInputSchema.parse({
    project_id: input.project_id || input.production_breakdown.project_id,
    title: input.title || input.production_breakdown.title,
    target_budget: input.target_budget != null ? parseSafeNumber(input.target_budget, null) : null,
    production_breakdown: input.production_breakdown
  });

  const breakdownJsonStr = JSON.stringify(validatedInput.production_breakdown, null, 2);
  const targetBudgetStr = validatedInput.target_budget ? `$${validatedInput.target_budget.toLocaleString()}` : 'Not Specified';

  const userPrompt = `Generate a project production budget based on the following Production Breakdown:

Project ID: ${validatedInput.project_id}
Title: ${validatedInput.title}
Target Budget: ${targetBudgetStr}

PRODUCTION BREAKDOWN JSON:
${breakdownJsonStr}

Return the complete Project Budget JSON object.`;

  const parsedPayload = await executeAgentWithPolicy({
    agentName: 'budget_agent',
    agent: budgetAgent,
    userPrompt,
    parseAndValidate: (extracted) => {
      const normalized = normalizeBudgetPayload(extracted, validatedInput);
      const validatedOutput = BudgetOutputSchema.parse(normalized);
      validateBudgetFidelity(validatedInput.production_breakdown, validatedOutput);
      return validatedOutput;
    }
  });

  const durationMs = Date.now() - startTime;
  return {
    ...parsedPayload,
    telemetry: {
      runId,
      projectId: parsedPayload.project_id,
      agentName: 'budget_agent',
      durationMs
    }
  };
}
