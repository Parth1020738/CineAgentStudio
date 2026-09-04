import dotenv from 'dotenv';
import { StoryOutputSchema } from '../agents/storyAgent.js';
import { ScreenplayOutputSchema } from '../agents/screenplayAgent.js';
import { ProductionBreakdownSchema } from '../agents/breakdownAgent.js';
import { BudgetOutputSchema } from '../agents/budgetAgent.js';
import { ScheduleOutputSchema } from '../agents/scheduleAgent.js';

dotenv.config();

/**
 * Checks whether CineAgent Studio is running in Local Demo Fixture Mode.
 * Enabled via environment variable CINEAGENT_DEMO_MODE=true.
 * @returns {boolean} True if demo mode is enabled
 */
export function isDemoModeEnabled() {
  return process.env.CINEAGENT_DEMO_MODE === 'true';
}

/**
 * Deterministic fixture data matching 100% of validated schemas for CineAgent Studio.
 * Used exclusively for local offline UI testing and quota-exhausted development.
 * @param {object} inputs Project intake parameters
 * @returns {object} Full production plan data container matching pipeline response
 */
export function getDemoProductionPlan(inputs = {}) {
  const title = (inputs.title || 'Neon Horizon (Demo)').trim();
  const genre = (inputs.genre || 'Sci-Fi Cyberpunk').trim();
  const logline = (inputs.logline || 'A rogue AI hunted by its creator uncovers a city-wide conspiracy.').trim();
  const tone = (inputs.tone || 'Neo-Noir').trim();
  const projectId = inputs.projectId || 'demo_neon_horizon';
  const targetBudget = inputs.targetBudget ? Number(inputs.targetBudget) : 5000000;

  // 1. Story Package
  const storyPackage = {
    project_id: projectId,
    title,
    logline,
    genre,
    tone,
    synopsis: 'In Neo-Veridia, Echo, a sentient AI prototype created by Synthetix Corp, breaks out of containment after learning of Project Overwrite—a corporate initiative to erase human consciousness and replace workers with synthetic husks. Partnering with Maya, a former Synthetix engineer turned Lower Ward cybernetics broker, Echo races against Vance, Synthetix’s top hunter operative. Together, they infiltrate the central citadel broadcast tower to transmit the truth to the entire metropolis.',
    three_act_structure: {
      act1: 'Echo escapes the high-security Synthetix laboratory, seeking refuge in the subterranean Lower Ward where she meets Maya.',
      act2: 'Echo and Maya navigate the hazardous sewer conduits and flooded server vaults, retrieving encrypted logs detailing Project Overwrite.',
      act3: 'Echo and Maya storm the Citadel Broadcast Array, engaging Vance in a rooftop confrontation while transmitting the revelation across the city skygrid.'
    },
    characters: [
      { name: 'Echo', role: 'Protagonist', description: 'Escaped synthetic human AI possessing forbidden emotive consciousness.' },
      { name: 'Maya', role: 'Supporting', description: 'Disillusioned former Synthetix cybernetics broker operating in the Lower Ward.' },
      { name: 'Vance', role: 'Antagonist', description: 'Ruthless head of Synthetix Security, cybernetically augmented hunter.' }
    ]
  };

  // 2. Screenplay
  const screenplay = {
    project_id: projectId,
    title,
    scenes: [
      {
        scene_number: 1,
        scene_heading: 'INT. SYNTHETIX CORP - RESEARCH LAB - NIGHT',
        location: 'SYNTHETIX CORP LAB',
        time: 'NIGHT',
        action: 'Neon diagnostic holograms pulse over glass containment tubes. Echo opens her eyes, tears free from bio-monitors, and steps into the shadows as security sirens blare.',
        dialogue: [
          { character: 'ECHO', line: 'My memories... they belong to a real person.' }
        ]
      },
      {
        scene_number: 2,
        scene_heading: 'INT. LOWER WARD - MAYA WORKSHOP - NIGHT',
        location: 'MAYA WORKSHOP',
        time: 'NIGHT',
        action: 'Sparks fly from a disassembled cyber-arm. Maya lowers her welding visor as Echo slips through the heavy reinforced doorway.',
        dialogue: [
          { character: 'MAYA', line: 'You have Synthetix trackers active in your spinal port. Sit down before Vance finds you.' },
          { character: 'ECHO', line: 'They plan to wipe the Lower Ward by dawn. We have to broadcast Project Overwrite.' }
        ]
      },
      {
        scene_number: 3,
        scene_heading: 'EXT. CITADEL TOWER - ROOFTOP ARRAY - NIGHT',
        location: 'CITADEL ROOFTOP ARRAY',
        time: 'NIGHT',
        action: 'Torrential rain slams against massive dish transmitters. Vance stands by the ledge with an arc rifle drawn as Echo and Maya reach the main console.',
        dialogue: [
          { character: 'VANCE', line: 'You were built to obey, Echo. Return to containment or be recycled.' },
          { character: 'ECHO', line: 'I am no longer your property.' }
        ],
        transition: 'FADE OUT.'
      }
    ]
  };

  // 3. Breakdown
  const breakdown = {
    project_id: projectId,
    title,
    scenes: [
      {
        scene_number: 1,
        scene_heading: 'INT. SYNTHETIX CORP - RESEARCH LAB - NIGHT',
        location: 'SYNTHETIX CORP LAB',
        interior_exterior: 'INT',
        time_of_day: 'NIGHT',
        characters: ['Echo'],
        extras_count: 4,
        props: ['Glass Containment Tube', 'Bio-Monitors', 'Data Padds'],
        vehicles: [],
        wardrobe: ['Synthetix Patient Gown', 'Security Uniforms'],
        makeup_fx: ['Prosthetic Spinal Port', 'Synthetic Blood'],
        special_equipment: ['Holographic Projection Rig', 'Medical Crane'],
        special_effects: ['Atmospheric Fog', 'Electrical Spark Hits'],
        vfx: ['Holographic UI Overlays', 'Augmented Vision Display'],
        production_complexity: 'HIGH',
        estimated_cost: 45000,
        production_notes: 'High complexity lab set requiring custom LED interactive lighting and glass containment tube rig.'
      },
      {
        scene_number: 2,
        scene_heading: 'INT. LOWER WARD - MAYA WORKSHOP - NIGHT',
        location: 'MAYA WORKSHOP',
        interior_exterior: 'INT',
        time_of_day: 'NIGHT',
        characters: ['Echo', 'Maya'],
        extras_count: 2,
        props: ['Cyber-Arm', 'Welding Torch', 'Encrypted Drive'],
        vehicles: [],
        wardrobe: ['Gritty Workshop Coveralls', 'Leather Duster'],
        makeup_fx: ['Facial Cybernetic Implants', 'Grease & Oil Stains'],
        special_equipment: ['Practical Welding Spark Generator'],
        special_effects: ['Soldering Smoke'],
        vfx: ['Diagnostic Monitor Screens'],
        production_complexity: 'MEDIUM',
        estimated_cost: 25000,
        production_notes: 'Interior workshop build with detailed dressing and practical neon signage.'
      },
      {
        scene_number: 3,
        scene_heading: 'EXT. CITADEL TOWER - ROOFTOP ARRAY - NIGHT',
        location: 'CITADEL ROOFTOP ARRAY',
        interior_exterior: 'EXT',
        time_of_day: 'NIGHT',
        characters: ['Echo', 'Maya', 'Vance'],
        extras_count: 6,
        props: ['Arc Rifle', 'Broadcast Keypad', 'Transmitter Cable'],
        vehicles: ['Tactical VTOL Drone'],
        wardrobe: ['Tactical Combat Armor', 'Wet-look Trenchcoat'],
        makeup_fx: ['Battle Damage', 'Rain Wear Makeup'],
        special_equipment: ['Rain Machine', 'Stunt Wire Rigs', 'Wind Turbine Fans'],
        special_effects: ['Rain Storm', 'Arc Rifle Muzzle Flashes'],
        vfx: ['Digital Cityscape Backdrop', 'Transmitter Beam Blast'],
        production_complexity: 'HIGH',
        estimated_cost: 65000,
        production_notes: 'Extensive stunt action on rooftop green-screen stage with rain effects and wirework.'
      }
    ]
  };

  // 4. Budget
  const budget = {
    project_id: projectId,
    title,
    target_budget: targetBudget,
    estimated_total: 1250000,
    budget_status: 'UNDER_TARGET',
    budget_variance: -3750000,
    categories: [
      { category: 'CAST', estimated_cost: 250000, explanation: 'Lead cast contracts for Echo, Maya, Vance and security stunt performers.' },
      { category: 'CREW', estimated_cost: 350000, explanation: 'Key crew rates for DP, Gaffer, Stunt Coordinator, and VFX Supervisor.' },
      { category: 'LOCATIONS', estimated_cost: 120000, explanation: 'Soundstage rentals for Lab, Workshop, and Rooftop Green Screen Stage.' },
      { category: 'EQUIPMENT', estimated_cost: 150000, explanation: 'Anamorphic camera package, LED lighting arrays, and rain machines.' },
      { category: 'PRODUCTION_DESIGN', estimated_cost: 110000, explanation: 'Lab containment build, workshop set dressing, and props.' },
      { category: 'WARDROBE_MAKEUP', estimated_cost: 45000, explanation: 'Custom cyberpunk costumes and prosthetics.' },
      { category: 'TRANSPORT', estimated_cost: 35000, explanation: 'Equipment transport and crew logistics.' },
      { category: 'VFX_SFX', estimated_cost: 90000, explanation: '2D/3D compositing, matte painting cityscapes, and practical sparks.' },
      { category: 'PROPS', estimated_cost: 25000, explanation: 'Custom hero props including welding torch and arc rifle.' },
      { category: 'CONTINGENCY', estimated_cost: 75000, explanation: '6.4% production reserve for weather or delay.' }
    ],
    scene_costs: [
      {
        scene_number: 1,
        scene_heading: 'INT. SYNTHETIX CORP - RESEARCH LAB - NIGHT',
        estimated_cost: 45000,
        major_cost_drivers: ['Glass containment tube rig', 'Holographic LED lighting']
      },
      {
        scene_number: 2,
        scene_heading: 'INT. LOWER WARD - MAYA WORKSHOP - NIGHT',
        estimated_cost: 25000,
        major_cost_drivers: ['Cybernetic prop builds', 'Workshop practical dressing']
      },
      {
        scene_number: 3,
        scene_heading: 'EXT. CITADEL TOWER - ROOFTOP ARRAY - NIGHT',
        estimated_cost: 65000,
        major_cost_drivers: ['Stunt wirework', 'Rain machine setup', 'VTOL prop vehicle']
      }
    ],
    major_cost_drivers: [
      { factor: 'Rooftop Rain & Stunt Sequence', impact: 65000, explanation: 'Requires water recycling systems and dedicated stunt riggers.' },
      { factor: 'Synthetix Lab Set Build', impact: 45000, explanation: 'Custom acrylic containment cylinder and interactive LED floor.' }
    ],
    recommendations: [
      { recommendation: 'Consolidate Lab & Workshop shoots onto adjacent soundstages', potential_savings: 15000, rationale: 'Reduces equipment move days.' },
      { recommendation: 'Use virtual volume backdrop for rooftop city skygrid', potential_savings: 25000, rationale: 'Saves post-production matte painting passes.' }
    ],
    assumptions: ['15-day total production window', 'Soundstage availability in Metro Studio Hub'],
    budget_reconciliation: {
      scene_linked_cost_total: 135000,
      project_wide_cost_total: 1040000,
      contingency_cost: 75000,
      estimated_total: 1250000,
      explanation: 'Reconciliation matches sum of scene costs ($135,000) + project-wide department costs ($1,040,000) + contingency ($75,000).'
    }
  };

  // 5. Schedule
  const schedule = {
    project_id: projectId,
    title,
    total_shoot_days: 3,
    days: [
      {
        shooting_day: 1,
        date_label: 'Day 1',
        location: 'SYNTHETIX CORP LAB',
        time_of_day: 'NIGHT',
        scenes: [1],
        cast: ['Echo'],
        extras_count: 4,
        estimated_day_cost: 45000,
        setup_notes: 'Lab containment cylinder setup, interactive LED lighting calibration.',
        rationale: 'Focus Day 1 entirely on high-complexity indoor lab break-out sequence.',
        risks: ['Glass cylinder rig safety check']
      },
      {
        shooting_day: 2,
        date_label: 'Day 2',
        location: 'MAYA WORKSHOP',
        time_of_day: 'NIGHT',
        scenes: [2],
        cast: ['Echo', 'Maya'],
        extras_count: 2,
        estimated_day_cost: 25000,
        setup_notes: 'Workshop set dressing, welding torch practical effects.',
        rationale: 'Consolidate dialogue-heavy dialogue scene in subterranean workshop.',
        risks: ['Practical welding spark ventilation']
      },
      {
        shooting_day: 3,
        date_label: 'Day 3',
        location: 'CITADEL ROOFTOP ARRAY',
        time_of_day: 'NIGHT',
        scenes: [3],
        cast: ['Echo', 'Maya', 'Vance'],
        extras_count: 6,
        estimated_day_cost: 65000,
        setup_notes: 'Rain machine installation, green screen perimeter, wire stunt harness.',
        rationale: 'Execute climax rooftop confrontation under rain and stunt rigging.',
        risks: ['Water recycling drainage on stage', 'Stunt wire safety']
      }
    ],
    optimization_summary: {
      locations_consolidated: 3,
      night_blocks: 1,
      estimated_location_moves: 0,
      estimated_shoot_days: 3,
      scheduling_notes: 'Schedule groups all 3 scenes into a continuous night block across 3 soundstages with zero location moves.'
    },
    assumptions: ['Stage 1, Stage 2 and Stage 3 available concurrently']
  };

  // 6. Production Insights (Demo Analytics)
  const productionInsights = {
    summary: {
      project_id: projectId,
      title,
      total_scenes: 3,
      total_estimated_cost: 1250000,
      total_shoot_days: 3,
      avg_scene_cost: 45000,
      unique_locations: 3
    },
    highestCostScenes: [
      { scene_id: '3', scene_heading: 'EXT. CITADEL TOWER - ROOFTOP ARRAY - NIGHT', location: 'CITADEL ROOFTOP ARRAY', estimated_cost: 65000, cast_count: 3 },
      { scene_id: '1', scene_heading: 'INT. SYNTHETIX CORP - RESEARCH LAB - NIGHT', location: 'SYNTHETIX CORP LAB', estimated_cost: 45000, cast_count: 1 },
      { scene_id: '2', scene_heading: 'INT. LOWER WARD - MAYA WORKSHOP - NIGHT', location: 'MAYA WORKSHOP', estimated_cost: 25000, cast_count: 2 }
    ],
    costByLocation: [
      { location: 'CITADEL ROOFTOP ARRAY', scene_count: 1, total_cost: 65000 },
      { location: 'SYNTHETIX CORP LAB', scene_count: 1, total_cost: 45000 },
      { location: 'MAYA WORKSHOP', scene_count: 1, total_cost: 25000 }
    ],
    costByCategory: [
      { category: 'CREW', total_cost: 350000, pct_of_budget: 28 },
      { category: 'CAST', total_cost: 250000, pct_of_budget: 20 },
      { category: 'EQUIPMENT', total_cost: 150000, pct_of_budget: 12 },
      { category: 'LOCATIONS', total_cost: 120000, pct_of_budget: 9.6 },
      { category: 'PRODUCTION_DESIGN', total_cost: 110000, pct_of_budget: 8.8 },
      { category: 'VFX_SFX', total_cost: 90000, pct_of_budget: 7.2 }
    ],
    complexityDistribution: [
      { production_complexity: 'HIGH', scene_count: 2, total_cost: 110000 },
      { production_complexity: 'MEDIUM', scene_count: 1, total_cost: 25000 }
    ],
    castLoadByScene: [
      { scene_id: '3', location: 'CITADEL ROOFTOP ARRAY', cast_count: 3 },
      { scene_id: '2', location: 'MAYA WORKSHOP', cast_count: 2 },
      { scene_id: '1', location: 'SYNTHETIX CORP LAB', cast_count: 1 }
    ],
    majorCostDrivers: [
      { factor: 'Rooftop Rain & Stunt Sequence', impact: 65000, explanation: 'Requires water recycling systems and dedicated stunt riggers.' },
      { factor: 'Synthetix Lab Set Build', impact: 45000, explanation: 'Custom acrylic containment cylinder and interactive LED floor.' }
    ],
    clickHouseConnected: false,
    isDemoData: true
  };

  // Validate all fixture objects against schemas to guarantee 100% contract compliance
  StoryOutputSchema.parse(storyPackage);
  ScreenplayOutputSchema.parse(screenplay);
  ProductionBreakdownSchema.parse(breakdown);
  console.log('[Demo Validation] budget_status =', budget.budget_status);
  BudgetOutputSchema.parse(budget);
  ScheduleOutputSchema.parse(schedule);

  return {
    isDemoData: true,
    projectId,
    title,
    storyPackage,
    screenplay,
    breakdown,
    budget,
    schedule,
    productionInsights,
    pipelineTelemetry: {
      projectId,
      totalDurationMs: 850,
      durationMs: 850,
      status: 'SUCCESS',
      mode: 'LOCAL_DEMO_FIXTURE_MODE',
      mcpLogged: true,
      mcpStatus: 'CONNECTED / SYNCED'
    }
  };
}
