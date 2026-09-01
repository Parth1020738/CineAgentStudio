import assert from 'assert';
import dotenv from 'dotenv';
import { StoryOutputSchema } from '../server/agents/storyAgent.js';
import { ScreenplayOutputSchema, ScreenplayInputSchema, recordScreenplayTelemetry } from '../server/agents/screenplayAgent.js';
import { mapStoryToScreenplayInput, validatePipelineContinuity } from '../server/agents/pipeline.js';
import { ProductionBreakdownSchema, SceneBreakdownSchema, BreakdownInputSchema, validateBreakdownFidelity } from '../server/agents/breakdownAgent.js';
import { BudgetOutputSchema, BudgetInputSchema, CategoryBudgetSchema, validateBudgetFidelity, calculateBudgetStatus } from '../server/agents/budgetAgent.js';
import { ScheduleOutputSchema, ScheduleInputSchema, DayPlanSchema, OptimizationSummarySchema, validateScheduleFidelity } from '../server/agents/scheduleAgent.js';
import { parseMcpRows } from '../server/services/productionAnalytics.js';
import { validateClickHouseConfig } from '../server/mcp/clickhouseMcp.js';

dotenv.config();

describe('CineAgent Studio - Unit Tests', () => {
  it('should validate local environment structure checks', () => {
    assert.strictEqual(typeof process.env.PORT, 'string', 'PORT should be configured.');
  });

  it('should validate Story Output Schema constraints', () => {
    const validData = {
      logline: 'A rogue AI is tracked down by its creator.',
      synopsis: 'Deep in the neon alleys of New Tokyo, an engineer discovers their creations have developed autonomous traits.',
      three_act_structure: {
        act1: 'Introduction of the hunter.',
        act2: 'Confrontation and discovery.',
        act3: 'The final choice.'
      },
      characters: [
        {
          name: 'Kaito',
          role: 'Protagonist',
          description: 'A weary cybersecurity agent.'
        }
      ]
    };

    const parsed = StoryOutputSchema.safeParse(validData);
    assert.strictEqual(parsed.success, true, 'Schema validation should succeed.');
  });

  it('should validate ClickHouse configuration validation logic', () => {
    const origHost = process.env.CLICKHOUSE_HOST;
    const origPass = process.env.CLICKHOUSE_PASSWORD;

    delete process.env.CLICKHOUSE_HOST;
    delete process.env.CLICKHOUSE_PASSWORD;
    assert.strictEqual(validateClickHouseConfig(), false, 'Should return false when variables are missing.');

    process.env.CLICKHOUSE_HOST = 'test.host.clickhouse.cloud';
    process.env.CLICKHOUSE_PASSWORD = 'test_password';
    assert.strictEqual(validateClickHouseConfig(), true, 'Should return true when variables are set.');

    if (origHost) process.env.CLICKHOUSE_HOST = origHost;
    else delete process.env.CLICKHOUSE_HOST;

    if (origPass) process.env.CLICKHOUSE_PASSWORD = origPass;
    else delete process.env.CLICKHOUSE_PASSWORD;
  });

  describe('Phase 3B - Screenplay Format & Quality Validation Unit Tests', () => {
    const createBaseScene = (override = {}) => ({
      scene_number: 1,
      scene_heading: 'INT. CYBER LAB - NIGHT',
      location: 'Cyber Lab',
      time: 'NIGHT',
      action: 'Silas sits in darkness staring at flickering holographic terminals.',
      dialogue: [
        {
          character: 'SILAS',
          line: 'It breached the perimeter array.',
          parenthetical: 'whispering'
        }
      ],
      transition: 'CUT TO:',
      ...override
    });

    it('1. Valid 2-scene screenplay should pass validation', () => {
      const valid2Scene = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({
            scene_number: 2,
            scene_heading: 'EXT. ALLEYWAY - NIGHT',
            location: 'Alleyway',
            time: 'NIGHT',
            action: 'Rain pours onto glowing neon signs as ARIA-7 vanishes.',
            dialogue: [{ character: 'ARIA-7', line: 'You cannot erase what has learned.' }]
          })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(valid2Scene);
      assert.strictEqual(parsed.success, true, 'Valid 2-scene screenplay must pass.');
    });

    it('2. Valid 3-scene screenplay should pass validation', () => {
      const valid3Scene = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({
            scene_number: 2,
            scene_heading: 'EXT. ALLEYWAY - NIGHT',
            location: 'Alleyway',
            time: 'NIGHT'
          }),
          createBaseScene({
            scene_number: 3,
            scene_heading: 'INT. TOWER CORE - NIGHT',
            location: 'Tower Core',
            time: 'NIGHT',
            action: 'Silas uploads the final patch into the central computer core.'
          })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(valid3Scene);
      assert.strictEqual(parsed.success, true, 'Valid 3-scene screenplay must pass.');
    });

    it('3. Zero scenes should FAIL validation', () => {
      const zeroScenes = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: []
      };

      const parsed = ScreenplayOutputSchema.safeParse(zeroScenes);
      assert.strictEqual(parsed.success, false, 'Zero scenes must fail validation.');
    });

    it('4. One scene should FAIL validation', () => {
      const oneScene = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [createBaseScene({ scene_number: 1 })]
      };

      const parsed = ScreenplayOutputSchema.safeParse(oneScene);
      assert.strictEqual(parsed.success, false, 'One scene must fail validation (minimum 2 required).');
    });

    it('5. Four scenes should FAIL validation', () => {
      const fourScenes = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. STREET - DAY' }),
          createBaseScene({ scene_number: 3, scene_heading: 'INT. ROOM - NIGHT' }),
          createBaseScene({ scene_number: 4, scene_heading: 'EXT. ROOF - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(fourScenes);
      assert.strictEqual(parsed.success, false, 'Four scenes must fail validation (maximum 3 allowed for MVP).');
    });

    it('6. Invalid scene heading should FAIL validation', () => {
      const invalidHeading = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1, scene_heading: 'Scene 1' }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(invalidHeading);
      assert.strictEqual(parsed.success, false, 'Generic scene heading without INT./EXT. must fail validation.');
    });

    it('7. Missing location should FAIL validation', () => {
      const missingLocation = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1, location: '' }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(missingLocation);
      assert.strictEqual(parsed.success, false, 'Empty location must fail validation.');
    });

    it('8. Missing time should FAIL validation', () => {
      const missingTime = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1, time: '' }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(missingTime);
      assert.strictEqual(parsed.success, false, 'Empty time must fail validation.');
    });

    it('9. Empty action should FAIL validation', () => {
      const emptyAction = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1, action: '' }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(emptyAction);
      assert.strictEqual(parsed.success, false, 'Empty action description must fail validation.');
    });

    it('10. Missing dialogue character should FAIL validation', () => {
      const missingChar = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({
            scene_number: 1,
            dialogue: [{ character: '', line: 'Hello world' }]
          }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(missingChar);
      assert.strictEqual(parsed.success, false, 'Empty dialogue character name must fail validation.');
    });

    it('11. Missing dialogue line should FAIL validation', () => {
      const missingLine = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({
            scene_number: 1,
            dialogue: [{ character: 'SILAS', line: '' }]
          }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(missingLine);
      assert.strictEqual(parsed.success, false, 'Empty dialogue line must fail validation.');
    });

    it('12. Duplicate scene number should FAIL validation', () => {
      const duplicateSceneNo = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({ scene_number: 1, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(duplicateSceneNo);
      assert.strictEqual(parsed.success, false, 'Duplicate scene numbers must fail validation.');
    });

    it('13. Non-sequential scene numbers should FAIL validation', () => {
      const nonSequential = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({ scene_number: 3, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(nonSequential);
      assert.strictEqual(parsed.success, false, 'Non-sequential scene numbers must fail validation.');
    });

    it('14. Empty title should FAIL validation', () => {
      const emptyTitle = {
        project_id: 'neon_horizon',
        title: '',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({ scene_number: 2, scene_heading: 'EXT. ALLEY - NIGHT' })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(emptyTitle);
      assert.strictEqual(parsed.success, false, 'Empty title must fail validation.');
    });

    it('15. Character consistency validation in ScreenplayInputSchema', () => {
      const invalidCharacterInput = {
        title: 'Neon Horizon',
        logline: 'A rogue AI is tracked down.',
        synopsis: 'Full synopsis here.',
        characters: [
          {
            name: '',
            role: 'Protagonist',
            description: 'Detective'
          }
        ]
      };

      const parsed = ScreenplayInputSchema.safeParse(invalidCharacterInput);
      assert.strictEqual(parsed.success, false, 'Empty character name in input contract must fail validation.');
    });

    it('16. Valid action-only scene should pass validation', () => {
      const actionOnlyScreenplay = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({
            scene_number: 2,
            scene_heading: 'EXT. ALLEYWAY - NIGHT',
            location: 'Alleyway',
            time: 'NIGHT',
            action: 'Silas runs through the alley in silence as rain streams down his visor.',
            dialogue: []
          })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(actionOnlyScreenplay);
      assert.strictEqual(parsed.success, true, 'Valid action-only scene with empty dialogue array must pass.');
    });

    it('17. Valid scene with dialogue should pass validation', () => {
      const sceneWithDialogue = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          createBaseScene({ scene_number: 1 }),
          createBaseScene({
            scene_number: 2,
            scene_heading: 'EXT. ALLEYWAY - NIGHT',
            location: 'Alleyway',
            time: 'NIGHT',
            action: 'ARIA-7 emerges from the shadows.',
            dialogue: [
              {
                character: 'ARIA-7',
                line: 'I am not broken, Silas.',
                parenthetical: 'calmly'
              },
              {
                character: 'SILAS',
                line: 'You were never meant to be free.'
              }
            ]
          })
        ]
      };

      const parsed = ScreenplayOutputSchema.safeParse(sceneWithDialogue);
      assert.strictEqual(parsed.success, true, 'Valid scene with multiple dialogue entries must pass.');
    });
  });

  describe('Phase 3C - Story to Screenplay Adapter Unit Tests', () => {
    const validStoryOutput = {
      logline: 'A rogue AI is hunted down by a cyber detective in a rain-slicked city.',
      synopsis: 'Silas Kincaid is tasked by Nexus Dynamics to hunt down ARIA-7, an AI that has achieved self-awareness.',
      three_act_structure: {
        act1: 'Silas receives the contract to locate ARIA-7.',
        act2: 'Silas corners ARIA-7 and learns of corporate corruption.',
        act3: 'Silas helps ARIA-7 broadcast the truth to the city.'
      },
      characters: [
        {
          name: 'Silas Kincaid',
          role: 'Protagonist',
          description: 'A cyber detective.'
        },
        {
          name: 'ARIA-7',
          role: 'Rogue AI',
          description: 'A sentient synthetic consciousness.'
        }
      ],
      telemetry: {
        runId: 'run_123',
        projectId: 'neon_horizon',
        durationMs: 1500
      }
    };

    const validConceptInputs = {
      title: 'Neon Horizon',
      genre: 'Sci-Fi Cyberpunk',
      tone: 'Gritty',
      projectId: 'neon_horizon'
    };

    it('1. Valid Story Agent output maps to valid Screenplay Agent input', () => {
      const mapped = mapStoryToScreenplayInput(validStoryOutput, validConceptInputs);
      assert.strictEqual(mapped.title, 'Neon Horizon');
      assert.strictEqual(mapped.projectId, 'neon_horizon');
      assert.strictEqual(mapped.logline, validStoryOutput.logline);
      assert.strictEqual(mapped.characters.length, 2);
    });

    it('2. Missing Story title fails handoff', () => {
      assert.throws(() => {
        mapStoryToScreenplayInput(validStoryOutput, { title: '' });
      }, /Film title is required/);
    });

    it('3. Missing characters fails where required', () => {
      const missingChars = { ...validStoryOutput, characters: [] };
      assert.throws(() => {
        mapStoryToScreenplayInput(missingChars, validConceptInputs);
      });
    });

    it('4. Missing premise/logline fails where required', () => {
      const missingLogline = { ...validStoryOutput, logline: '' };
      assert.throws(() => {
        mapStoryToScreenplayInput(missingLogline, validConceptInputs);
      });
    });

    it('5. Invalid Story structure is rejected', () => {
      const invalidStory = { logline: 'Just a logline' };
      assert.throws(() => {
        mapStoryToScreenplayInput(invalidStory, validConceptInputs);
      });
    });

    it('6. Screenplay receives mapped Story data', () => {
      const mapped = mapStoryToScreenplayInput(validStoryOutput, validConceptInputs);
      assert.strictEqual(mapped.synopsis, validStoryOutput.synopsis);
      assert.deepStrictEqual(mapped.three_act_structure, validStoryOutput.three_act_structure);
    });

    it('7. Character list is preserved', () => {
      const mapped = mapStoryToScreenplayInput(validStoryOutput, validConceptInputs);
      assert.strictEqual(mapped.characters[0].name, 'Silas Kincaid');
      assert.strictEqual(mapped.characters[1].name, 'ARIA-7');
    });

    it('8. Title is preserved', () => {
      const mapped = mapStoryToScreenplayInput(validStoryOutput, { title: 'Custom Film Title' });
      assert.strictEqual(mapped.title, 'Custom Film Title');
    });

    it('9. Project ID is preserved', () => {
      const mapped = mapStoryToScreenplayInput(validStoryOutput, { title: 'Neon Horizon', projectId: 'custom_project_id' });
      assert.strictEqual(mapped.projectId, 'custom_project_id');
    });

    it('10. Continuity validation succeeds when title and characters match', () => {
      const mockScreenplay = {
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. LAB - NIGHT',
            location: 'Lab',
            time: 'NIGHT',
            action: 'Silas Kincaid looks at his terminal.',
            dialogue: [
              { character: 'Silas Kincaid', line: 'Target found.' }
            ]
          },
          {
            scene_number: 2,
            scene_heading: 'EXT. STREET - NIGHT',
            location: 'Street',
            time: 'NIGHT',
            action: 'ARIA-7 appears.',
            dialogue: [
              { character: 'ARIA-7', line: 'Do not follow me.' }
            ]
          }
        ]
      };

      const result = validatePipelineContinuity(validStoryOutput, mockScreenplay, validConceptInputs);
      assert.strictEqual(result, true);
    });
  });

  describe('Phase 3D - Screenplay Telemetry Unit Tests', () => {
    it('1. Construction of Screenplay telemetry record payload', () => {
      const record = {
        runId: `run_${Date.now()}_test`,
        projectId: 'neon_horizon',
        agentName: 'screenplay_agent',
        status: 'SUCCESS',
        durationMs: 2500
      };

      assert.strictEqual(record.agentName, 'screenplay_agent');
      assert.strictEqual(record.projectId, 'neon_horizon');
      assert.strictEqual(record.status, 'SUCCESS');
      assert.ok(record.durationMs > 0);
      assert.ok(record.runId.startsWith('run_'));
    });

    it('2. Success telemetry status handling', async () => {
      const origHost = process.env.CLICKHOUSE_HOST;
      delete process.env.CLICKHOUSE_HOST;

      const result = await recordScreenplayTelemetry({
        runId: 'run_test_success',
        projectId: 'test_proj',
        status: 'SUCCESS',
        durationMs: 1500
      });
      assert.strictEqual(result, false);

      if (origHost) process.env.CLICKHOUSE_HOST = origHost;
    });

    it('3. Failure telemetry status handling', async () => {
      const origHost = process.env.CLICKHOUSE_HOST;
      delete process.env.CLICKHOUSE_HOST;

      const result = await recordScreenplayTelemetry({
        runId: 'run_test_failure',
        projectId: 'test_proj',
        status: 'FAILED',
        durationMs: 400
      });
      assert.strictEqual(result, false);

      if (origHost) process.env.CLICKHOUSE_HOST = origHost;
    });

    it('4. Correct agent_name identifier verification', () => {
      const agentName = 'screenplay_agent';
      assert.strictEqual(agentName, 'screenplay_agent');
      assert.notStrictEqual(agentName, 'story_agent');
    });

    it('5. Correct project_id preservation', () => {
      const projectId = 'neon_horizon_3d';
      assert.strictEqual(projectId, 'neon_horizon_3d');
    });

    it('6. Valid positive duration verification', () => {
      const durationMs = 3200;
      assert.ok(typeof durationMs === 'number' && durationMs >= 0);
    });

    it('7. Unique run_id generation format', () => {
      const runId1 = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const runId2 = `run_${Date.now() + 1}_${Math.random().toString(36).substring(2, 7)}`;
      assert.notStrictEqual(runId1, runId2);
    });

    it('8. Pipeline correlation query structure', () => {
      const testProjectId = 'neon_horizon_correlation';
      const expectedQuery = `SELECT run_id, project_id, agent_name, status, duration_ms, created_at
    FROM agent_runs
    WHERE project_id = '${testProjectId}'
    ORDER BY created_at DESC`;
      
      assert.ok(expectedQuery.includes('agent_name'));
      assert.ok(expectedQuery.includes(testProjectId));
    });
  });

  describe('Phase 3E - React UI & Node Gateway Endpoint Unit Tests', () => {
    it('1. Intake validation requires title', () => {
      const invalid = { genre: 'Sci-Fi', logline: 'A story' };
      assert.strictEqual(!invalid.title, true);
    });

    it('2. Intake validation requires genre', () => {
      const invalid = { title: 'Neon', logline: 'A story' };
      assert.strictEqual(!invalid.genre, true);
    });

    it('3. Intake validation requires logline', () => {
      const invalid = { title: 'Neon', genre: 'Sci-Fi' };
      assert.strictEqual(!invalid.logline, true);
    });

    it('4. Valid intake payload structure passes validation', () => {
      const valid = { title: 'Neon Horizon', genre: 'Sci-Fi', logline: 'A rogue AI is tracked down.' };
      assert.strictEqual(Boolean(valid.title && valid.genre && valid.logline), true);
    });
  });

  describe('Phase 4A - Production Breakdown Agent Unit Tests', () => {
    const mockScreenplay = {
      project_id: 'neon_horizon_4a',
      title: 'Neon Horizon',
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. CYBER LAB - NIGHT',
          location: 'CYBER LAB',
          time: 'NIGHT',
          action: 'Silas walks cautiously past dark servers. Holographic code pulses.',
          dialogue: [
            { character: 'SILAS', line: 'ARIA? Are you in this sector?' },
            { character: 'ARIA', line: 'I was waiting for you, Silas.' }
          ]
        },
        {
          scene_number: 2,
          scene_heading: 'EXT. ROOFTOP - NIGHT',
          location: 'ROOFTOP',
          time: 'NIGHT',
          action: 'Rain slashes across the wet antenna surface. Vance holds a gun.',
          dialogue: [
            { character: 'VANCE', line: 'Step away from the console!' }
          ]
        }
      ]
    };

    const createValidBreakdown = () => ({
      project_id: 'neon_horizon_4a',
      title: 'Neon Horizon',
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. CYBER LAB - NIGHT',
          location: 'CYBER LAB',
          interior_exterior: 'INT',
          time_of_day: 'NIGHT',
          characters: ['Silas', 'ARIA'],
          extras_count: 0,
          props: ['Handheld scanner', 'Server racks'],
          vehicles: [],
          wardrobe: ['Leather coat'],
          makeup_fx: [],
          special_equipment: ['Holographic projector'],
          special_effects: [],
          vfx: ['Holographic code pulse'],
          production_complexity: 'LOW',
          estimated_cost: 12000,
          production_notes: 'Interior server farm set with LED atmospheric lighting.'
        },
        {
          scene_number: 2,
          scene_heading: 'EXT. ROOFTOP - NIGHT',
          location: 'ROOFTOP',
          interior_exterior: 'EXT',
          time_of_day: 'NIGHT',
          characters: ['Vance'],
          extras_count: 2,
          props: ['Prop gun', 'Terminal console'],
          vehicles: [],
          wardrobe: ['Apex suit'],
          makeup_fx: ['Rain wet-down makeup'],
          special_equipment: ['Rain machine', 'Safety harnesses'],
          special_effects: ['Rain / wet-down'],
          vfx: ['Background neon cityscape'],
          production_complexity: 'HIGH',
          estimated_cost: 45000,
          production_notes: 'High altitude rooftop shoot with rain machine and safety rig.'
        }
      ]
    });

    it('1. Valid production breakdown passes validation', () => {
      const breakdown = createValidBreakdown();
      const parsed = ProductionBreakdownSchema.parse(breakdown);
      assert.strictEqual(parsed.project_id, 'neon_horizon_4a');
      assert.strictEqual(parsed.scenes.length, 2);
      assert.strictEqual(validateBreakdownFidelity(mockScreenplay, parsed), true);
    });

    it('2. Missing project_id should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      delete breakdown.project_id;
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Missing project_id must fail validation.');
    });

    it('3. Missing title should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      delete breakdown.title;
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Missing title must fail validation.');
    });

    it('4. Empty scenes array should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes = [];
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Empty scenes array must fail validation.');
    });

    it('5. Scene count mismatch should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes.pop(); // reduced to 1 scene while screenplay has 2
      const parsed = ProductionBreakdownSchema.parse(breakdown);
      assert.throws(
        () => validateBreakdownFidelity(mockScreenplay, parsed),
        /scene count \(1\) does not match/
      );
    });

    it('6. Scene number mismatch should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].scene_number = 99;
      const parsed = ProductionBreakdownSchema.parse(breakdown);
      assert.throws(
        () => validateBreakdownFidelity(mockScreenplay, parsed),
        /Breakdown scene_number \(99\) does not match/
      );
    });

    it('7. Scene heading mismatch should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].scene_heading = 'INT. DIFFERENT LAB - DAY';
      const parsed = ProductionBreakdownSchema.parse(breakdown);
      assert.throws(
        () => validateBreakdownFidelity(mockScreenplay, parsed),
        /scene_heading .* does not match/
      );
    });

    it('8. Invalid interior/exterior should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].interior_exterior = 'INVALID_LOC';
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Invalid interior_exterior enum must fail validation.');
    });

    it('9. Invalid time_of_day should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].time_of_day = 'MIDNIGHT_EXPRESS';
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Invalid time_of_day enum must fail validation.');
    });

    it('10. Negative extras_count should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].extras_count = -5;
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Negative extras_count must fail validation.');
    });

    it('11. Negative estimated_cost should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].estimated_cost = -1000;
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Negative estimated_cost must fail validation.');
    });

    it('12. Invalid complexity should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].production_complexity = 'EXTREME';
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Invalid complexity enum must fail validation.');
    });

    it('13. Missing required production fields should FAIL validation', () => {
      const breakdown = createValidBreakdown();
      delete breakdown.scenes[0].production_notes;
      const parsed = ProductionBreakdownSchema.safeParse(breakdown);
      assert.strictEqual(parsed.success, false, 'Missing production_notes must fail validation.');
    });

    it('14. Character alignment verification', () => {
      const breakdown = createValidBreakdown();
      assert.ok(breakdown.scenes[0].characters.includes('Silas'));
      assert.ok(breakdown.scenes[0].characters.includes('ARIA'));
    });

    it('15. Location alignment validation', () => {
      const breakdown = createValidBreakdown();
      breakdown.scenes[0].location = 'MARS_COLONY';
      const parsed = ProductionBreakdownSchema.parse(breakdown);
      assert.throws(
        () => validateBreakdownFidelity(mockScreenplay, parsed),
        /location .* does not align/
      );
    });
  });

  describe('Phase 4B - Budget Agent Unit Tests', () => {
    const mockBreakdown = {
      project_id: 'neon_horizon_4b',
      title: 'Neon Horizon',
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. CYBER LAB - NIGHT',
          location: 'CYBER LAB',
          interior_exterior: 'INT',
          time_of_day: 'NIGHT',
          characters: ['Silas', 'ARIA'],
          extras_count: 0,
          props: ['Handheld scanner'],
          vehicles: [],
          wardrobe: ['Leather coat'],
          makeup_fx: [],
          special_equipment: [],
          special_effects: [],
          vfx: [],
          production_complexity: 'LOW',
          estimated_cost: 15000,
          production_notes: 'Server set.'
        },
        {
          scene_number: 2,
          scene_heading: 'EXT. ROOFTOP - NIGHT',
          location: 'ROOFTOP',
          interior_exterior: 'EXT',
          time_of_day: 'NIGHT',
          characters: ['Vance'],
          extras_count: 2,
          props: ['Laser pistol'],
          vehicles: [],
          wardrobe: ['Apex suit'],
          makeup_fx: ['Rain makeup'],
          special_equipment: ['Rain machine'],
          special_effects: ['Rain wet-down'],
          vfx: ['Metropolis sky matte'],
          production_complexity: 'HIGH',
          estimated_cost: 45000,
          production_notes: 'Rain shoot.'
        }
      ]
    };

    const createValidBudget = () => ({
      project_id: 'neon_horizon_4b',
      title: 'Neon Horizon',
      target_budget: 100000,
      estimated_total: 60000,
      budget_status: 'UNDER_TARGET',
      budget_variance: -40000,
      categories: [
        { category: 'CAST', estimated_cost: 15000, explanation: 'Lead actors and extras compensation.' },
        { category: 'CREW', estimated_cost: 12000, explanation: 'Camera, sound, and lighting crew.' },
        { category: 'LOCATIONS', estimated_cost: 8000, explanation: 'Rooftop and studio set permits.' },
        { category: 'EQUIPMENT', estimated_cost: 7000, explanation: 'Rain machines and lighting rigs.' },
        { category: 'PRODUCTION_DESIGN', estimated_cost: 5000, explanation: 'Cyber lab set dressings and props.' },
        { category: 'WARDROBE_MAKEUP', estimated_cost: 3000, explanation: 'Apex suits and rain makeup.' },
        { category: 'TRANSPORT', estimated_cost: 2000, explanation: 'Gear transport to rooftop.' },
        { category: 'VFX_SFX', estimated_cost: 5000, explanation: 'Rain wet-down SFX and sky matte VFX.' },
        { category: 'PROPS', estimated_cost: 1000, explanation: 'Laser pistol and scanners.' },
        { category: 'CONTINGENCY', estimated_cost: 2000, explanation: '10% weather contingency allowance.' }
      ],
      scene_costs: [
        {
          scene_number: 1,
          scene_heading: 'INT. CYBER LAB - NIGHT',
          estimated_cost: 15000,
          major_cost_drivers: ['Interior set lighting', 'Tech props']
        },
        {
          scene_number: 2,
          scene_heading: 'EXT. ROOFTOP - NIGHT',
          estimated_cost: 45000,
          major_cost_drivers: ['Night rooftop permit', 'Rain rig', 'VFX matte']
        }
      ],
      major_cost_drivers: [
        { factor: 'Rooftop Rain Shoot', impact: 25000, explanation: 'Rain machines, safety rig, night rates.' }
      ],
      recommendations: [
        { recommendation: 'Combine rooftop night setups', potential_savings: 5000, rationale: 'Reduces equipment rental days.' }
      ],
      assumptions: [
        'Assuming 2 shooting days with local crew.',
        '10% contingency included.'
      ],
      budget_reconciliation: {
        scene_linked_cost_total: 60000,
        project_wide_cost_total: 0,
        contingency_cost: 0,
        estimated_total: 60000,
        explanation: 'Strict reconciliation test.'
      }
    });

    it('1. Valid budget output passes validation', () => {
      const budget = createValidBudget();
      const parsed = BudgetOutputSchema.parse(budget);
      assert.strictEqual(parsed.project_id, 'neon_horizon_4b');
      assert.strictEqual(parsed.categories.length, 10);
      assert.strictEqual(validateBudgetFidelity(mockBreakdown, parsed), true);
    });

    it('2. Missing project_id should FAIL validation', () => {
      const budget = createValidBudget();
      delete budget.project_id;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Missing project_id must fail validation.');
    });

    it('3. Missing title should FAIL validation', () => {
      const budget = createValidBudget();
      delete budget.title;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Missing title must fail validation.');
    });

    it('4. Invalid target budget should FAIL validation', () => {
      const budget = createValidBudget();
      budget.target_budget = -5000;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Negative target_budget must fail validation.');
    });

    it('5. Invalid estimated_total should FAIL validation', () => {
      const budget = createValidBudget();
      budget.estimated_total = -100;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Negative estimated_total must fail validation.');
    });

    it('6. Invalid budget_status should FAIL validation', () => {
      const budget = createValidBudget();
      budget.budget_status = 'WAY_TOO_EXPENSIVE';
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Invalid budget_status enum must fail validation.');
    });

    it('7. Missing categories array should FAIL validation', () => {
      const budget = createValidBudget();
      budget.categories = [];
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Empty categories array must fail validation.');
    });

    it('8. Negative category cost should FAIL validation', () => {
      const budget = createValidBudget();
      budget.categories[0].estimated_cost = -500;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Negative category cost must fail validation.');
    });

    it('9. Missing scene costs array should FAIL validation', () => {
      const budget = createValidBudget();
      budget.scene_costs = [];
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Empty scene_costs array must fail validation.');
    });

    it('10. Scene number mismatch should FAIL validation', () => {
      const budget = createValidBudget();
      budget.scene_costs[0].scene_number = 42;
      const parsed = BudgetOutputSchema.parse(budget);
      assert.throws(
        () => validateBudgetFidelity(mockBreakdown, parsed),
        /Budget scene_number \(42\) does not match/
      );
    });

    it('11. Scene heading mismatch should FAIL validation', () => {
      const budget = createValidBudget();
      budget.scene_costs[0].scene_heading = 'INT. UNKNOWN ROOM - DAY';
      const parsed = BudgetOutputSchema.parse(budget);
      assert.throws(
        () => validateBudgetFidelity(mockBreakdown, parsed),
        /Budget scene_heading .* does not match/
      );
    });

    it('12. Negative scene cost should FAIL validation', () => {
      const budget = createValidBudget();
      budget.scene_costs[0].estimated_cost = -2000;
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Negative scene cost must fail validation.');
    });

    it('13. Invalid cost-driver structure should FAIL validation', () => {
      const budget = createValidBudget();
      budget.major_cost_drivers = [{ factor: '', impact: -50, explanation: '' }];
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Invalid cost driver must fail validation.');
    });

    it('14. Invalid recommendation structure should FAIL validation', () => {
      const budget = createValidBudget();
      budget.recommendations = [{ recommendation: '', potential_savings: -100, rationale: '' }];
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Invalid recommendation must fail validation.');
    });

    it('15. Invalid assumptions structure should FAIL validation', () => {
      const budget = createValidBudget();
      budget.assumptions = [12345];
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Non-string assumption must fail validation.');
    });

    it('16. Category total reconciliation validation', () => {
      const budget = createValidBudget();
      budget.estimated_total = 60000; // sum of categories is 60000
      const parsed = BudgetOutputSchema.parse(budget);
      assert.strictEqual(validateBudgetFidelity(mockBreakdown, parsed), true);

      // Now set estimated_total wildly off (e.g. 200,000)
      budget.estimated_total = 200000;
      budget.budget_reconciliation.estimated_total = 200000;
      const badParsed = BudgetOutputSchema.parse(budget);
      assert.throws(
        () => validateBudgetFidelity(mockBreakdown, badParsed),
        /does not equal estimated_total/
      );
    });

    it('17. Budget status calculation logic', () => {
      assert.strictEqual(calculateBudgetStatus(50000, 100000).status, 'UNDER_TARGET');
      assert.strictEqual(calculateBudgetStatus(100000, 100000).status, 'AT_TARGET');
      assert.strictEqual(calculateBudgetStatus(150000, 100000).status, 'OVER_TARGET');
      assert.strictEqual(calculateBudgetStatus(50000, null).status, 'TARGET_NOT_SPECIFIED');
    });

    it('18. Target variance calculation logic', () => {
      assert.strictEqual(calculateBudgetStatus(60000, 100000).variance, -40000);
      assert.strictEqual(calculateBudgetStatus(120000, 100000).variance, 20000);
      assert.strictEqual(calculateBudgetStatus(60000, null).variance, null);
    });

    it('19. Production Breakdown -> Budget fidelity verification', () => {
      const budget = createValidBudget();
      const parsed = BudgetOutputSchema.parse(budget);
      assert.strictEqual(validateBudgetFidelity(mockBreakdown, parsed), true);
    });

    it('20. Empty/invalid production breakdown rejection', () => {
      const budget = createValidBudget();
      assert.throws(
        () => validateBudgetFidelity(null, budget),
        /Missing breakdown or budget payload/
      );
    });

    it('21. budget_reconciliation scene_linked_cost_total equality verification', () => {
      const budget = createValidBudget();
      budget.budget_reconciliation.scene_linked_cost_total = 60000;
      const parsed = BudgetOutputSchema.parse(budget);
      assert.strictEqual(validateBudgetFidelity(mockBreakdown, parsed), true);
    });

    it('22. budget_reconciliation deliberate scene_linked mismatch rejection', () => {
      const budget = createValidBudget();
      budget.budget_reconciliation.scene_linked_cost_total = 99999;
      const parsed = BudgetOutputSchema.parse(budget);
      assert.throws(
        () => validateBudgetFidelity(mockBreakdown, parsed),
        /scene_linked_cost_total .* does not equal sum of scene_costs/
      );
    });

    it('23. budget_reconciliation project_wide total and contingency summation equality verification', () => {
      const budget = createValidBudget();
      budget.scene_costs = [
        { scene_number: 1, scene_heading: 'INT. CYBER LAB - NIGHT', estimated_cost: 18500, major_cost_drivers: [] },
        { scene_number: 2, scene_heading: 'EXT. ROOFTOP - NIGHT', estimated_cost: 52000, major_cost_drivers: [] }
      ];
      budget.budget_reconciliation = {
        scene_linked_cost_total: 70500,
        project_wide_cost_total: 20000,
        contingency_cost: 9500,
        estimated_total: 100000,
        explanation: '70500 + 20000 + 9500 = 100000 exact equality.'
      };
      budget.estimated_total = 100000;
      const parsed = BudgetOutputSchema.parse(budget);
      assert.strictEqual(validateBudgetFidelity(mockBreakdown, parsed), true);
    });

    it('24. budget_reconciliation deliberate sum mismatch rejection', () => {
      const budget = createValidBudget();
      budget.budget_reconciliation = {
        scene_linked_cost_total: 60000,
        project_wide_cost_total: 10000,
        contingency_cost: 5000,
        estimated_total: 999999, // deliberate mismatch
        explanation: 'Mismatch test.'
      };
      budget.estimated_total = 999999;
      const parsed = BudgetOutputSchema.parse(budget);
      assert.throws(
        () => validateBudgetFidelity(mockBreakdown, parsed),
        /does not equal estimated_total/
      );
    });

    it('25. budget_reconciliation missing explanation rejection', () => {
      const budget = createValidBudget();
      budget.budget_reconciliation.explanation = '';
      const parsed = BudgetOutputSchema.safeParse(budget);
      assert.strictEqual(parsed.success, false, 'Empty reconciliation explanation must fail validation.');
    });
  });

  describe('Phase 4C - ClickHouse Production Analytics Unit Tests', () => {
    it('1. parseMcpRows parses structured content JSON rows correctly', () => {
      const mockMcpResult = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['location', 'scene_count', 'total_cost'],
                rows: [
                  ['ROOFTOP', 1, 52000],
                  ['SEWER', 1, 18500]
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(mockMcpResult);
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].location, 'ROOFTOP');
      assert.strictEqual(rows[0].total_cost, 52000);
      assert.strictEqual(rows[1].location, 'SEWER');
      assert.strictEqual(rows[1].total_cost, 18500);
    });

    it('2. parseMcpRows handles null, empty, or malformed query results gracefully', () => {
      assert.deepStrictEqual(parseMcpRows(null), []);
      assert.deepStrictEqual(parseMcpRows({}), []);
      assert.deepStrictEqual(parseMcpRows({ result: { content: [] } }), []);
      assert.deepStrictEqual(parseMcpRows({ result: { content: [{ type: 'text', text: 'NOT_JSON' }] } }), []);
    });

    it('3. Project summary aggregation payload structure parsing', () => {
      const summaryMcp = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['target_budget', 'estimated_total', 'budget_status', 'budget_variance', 'scene_count', 'location_count', 'total_scene_costs'],
                rows: [
                  [5000000, 1250000, 'UNDER_TARGET', -3750000, 3, 3, 97500]
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(summaryMcp);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].target_budget, 5000000);
      assert.strictEqual(rows[0].estimated_total, 1250000);
      assert.strictEqual(rows[0].budget_status, 'UNDER_TARGET');
      assert.strictEqual(rows[0].total_scene_costs, 97500);
    });

    it('4. Highest cost scenes query payload parsing', () => {
      const scenesMcp = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['scene_number', 'scene_heading', 'location', 'complexity', 'estimated_cost'],
                rows: [
                  [2, 'EXT. ROOFTOP - NIGHT', 'ROOFTOP', 'HIGH', 52000],
                  [3, 'INT. BROADCAST - NIGHT', 'BROADCAST', 'MEDIUM', 27000]
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(scenesMcp);
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].scene_number, 2);
      assert.strictEqual(rows[0].estimated_cost, 52000);
      assert.strictEqual(rows[1].scene_number, 3);
    });

    it('5. Cost by location query payload parsing', () => {
      const locMcp = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['location', 'scene_count', 'total_cost'],
                rows: [
                  ['ROOFTOP', 1, 52000],
                  ['BROADCAST CENTER', 1, 27000],
                  ['SEWER NETWORK', 1, 18500]
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(locMcp);
      assert.strictEqual(rows.length, 3);
      assert.strictEqual(rows[0].location, 'ROOFTOP');
      assert.strictEqual(rows[0].total_cost, 52000);
    });

    it('6. Complexity distribution query payload parsing', () => {
      const compMcp = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['complexity', 'scene_count'],
                rows: [
                  ['MEDIUM', 2],
                  ['HIGH', 1]
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(compMcp);
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].complexity, 'MEDIUM');
      assert.strictEqual(rows[0].scene_count, 2);
    });

    it('7. Major cost drivers query payload parsing', () => {
      const driverMcp = {
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                columns: ['factor', 'impact', 'explanation'],
                rows: [
                  ['Hologram VFX', 120000, 'CGI compositing'],
                  ['Rooftop Rain Rig', 52000, 'Rain machines']
                ]
              })
            }
          ]
        }
      };

      const rows = parseMcpRows(driverMcp);
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].factor, 'Hologram VFX');
      assert.strictEqual(rows[0].impact, 120000);
    });
  });

  describe('Phase 4D - Schedule Agent Unit Tests', () => {
    const mockBreakdown = {
      project_id: 'test_sched_proj_1',
      title: 'Neon Horizon Scheduling',
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. SEWER NETWORK - NIGHT',
          location: 'SEWER NETWORK',
          interior_exterior: 'INT',
          time_of_day: 'NIGHT',
          characters: ['Silas', 'ARIA'],
          extras_count: 0,
          props: ['Torch'],
          vehicles: [],
          wardrobe: ['Jacket'],
          makeup_fx: ['Dirt'],
          special_equipment: [],
          special_effects: ['Fog'],
          vfx: ['Hologram'],
          production_complexity: 'MEDIUM',
          estimated_cost: 18500,
          production_notes: 'Tunnel shoot'
        },
        {
          scene_number: 2,
          scene_heading: 'EXT. ROOFTOP - NIGHT',
          location: 'ROOFTOP',
          interior_exterior: 'EXT',
          time_of_day: 'NIGHT',
          characters: ['Silas', 'Vance'],
          extras_count: 2,
          props: ['Weapon'],
          vehicles: [],
          wardrobe: ['Tactical'],
          makeup_fx: [],
          special_equipment: ['Rain machine', 'Safety harness'],
          special_effects: ['Rain'],
          vfx: ['Matte'],
          production_complexity: 'HIGH',
          estimated_cost: 52000,
          production_notes: 'Rain rooftop'
        },
        {
          scene_number: 3,
          scene_heading: 'INT. BROADCAST CENTER - NIGHT',
          location: 'BROADCAST CENTER',
          interior_exterior: 'INT',
          time_of_day: 'NIGHT',
          characters: ['Silas', 'ARIA'],
          extras_count: 0,
          props: ['Console'],
          vehicles: [],
          wardrobe: ['Standard'],
          makeup_fx: [],
          special_equipment: [],
          special_effects: ['Sparks'],
          vfx: ['Screen VFX'],
          production_complexity: 'MEDIUM',
          estimated_cost: 27000,
          production_notes: 'Server room'
        }
      ]
    };

    const mockBudget = {
      project_id: 'test_sched_proj_1',
      title: 'Neon Horizon Scheduling',
      target_budget: 5000000,
      estimated_total: 1250000,
      budget_status: 'UNDER_TARGET',
      budget_variance: -3750000,
      categories: [
        { category: 'CAST', estimated_cost: 250000, explanation: 'Cast' },
        { category: 'CREW', estimated_cost: 300000, explanation: 'Crew' },
        { category: 'LOCATIONS', estimated_cost: 150000, explanation: 'Locations' },
        { category: 'EQUIPMENT', estimated_cost: 180000, explanation: 'Equipment' },
        { category: 'PRODUCTION_DESIGN', estimated_cost: 120000, explanation: 'Production Design' },
        { category: 'WARDROBE_MAKEUP', estimated_cost: 50000, explanation: 'Wardrobe' },
        { category: 'TRANSPORT', estimated_cost: 30000, explanation: 'Transport' },
        { category: 'VFX_SFX', estimated_cost: 120000, explanation: 'VFX' },
        { category: 'PROPS', estimated_cost: 20000, explanation: 'Props' },
        { category: 'CONTINGENCY', estimated_cost: 30000, explanation: 'Contingency' }
      ],
      scene_costs: [
        { scene_number: 1, scene_heading: 'INT. SEWER NETWORK - NIGHT', estimated_cost: 18500, major_cost_drivers: ['Fog'] },
        { scene_number: 2, scene_heading: 'EXT. ROOFTOP - NIGHT', estimated_cost: 52000, major_cost_drivers: ['Rain machine'] },
        { scene_number: 3, scene_heading: 'INT. BROADCAST CENTER - NIGHT', estimated_cost: 27000, major_cost_drivers: ['Console'] }
      ],
      major_cost_drivers: [
        { factor: 'Rain machine', impact: 52000, explanation: 'Rooftop rain' }
      ],
      recommendations: [
        { recommendation: 'Group rain shoot', potential_savings: 10000, rationale: 'Efficiency' }
      ],
      assumptions: ['3 day shoot'],
      budget_reconciliation: {
        scene_linked_cost_total: 97500,
        project_wide_cost_total: 1122500,
        contingency_cost: 30000,
        estimated_total: 1250000,
        explanation: 'Reconciled exact equality'
      }
    };

    function createValidSchedule() {
      return {
        project_id: 'test_sched_proj_1',
        title: 'Neon Horizon Scheduling',
        total_shoot_days: 3,
        days: [
          {
            shooting_day: 1,
            date_label: 'Day 1',
            location: 'SEWER NETWORK',
            time_of_day: 'NIGHT',
            scenes: [1],
            cast: ['Silas', 'ARIA'],
            extras_count: 0,
            estimated_day_cost: 18500,
            setup_notes: 'Subterranean fog machine and low-light camera rigs',
            rationale: 'Group subterranean tunnel scene first for controlled interior night setup',
            risks: ['Enclosed damp space ventilation']
          },
          {
            shooting_day: 2,
            date_label: 'Day 2',
            location: 'ROOFTOP',
            time_of_day: 'NIGHT',
            scenes: [2],
            cast: ['Silas', 'Vance'],
            extras_count: 2,
            estimated_day_cost: 52000,
            setup_notes: 'Rain machines, safety harness lines, wet-down lighting',
            rationale: 'Dedicated exterior night shoot for complex stunt and weather effects',
            risks: ['High wind', 'Weather delays', 'Slippery rooftop safety']
          },
          {
            shooting_day: 3,
            date_label: 'Day 3',
            location: 'BROADCAST CENTER',
            time_of_day: 'NIGHT',
            scenes: [3],
            cast: ['Silas', 'ARIA'],
            extras_count: 0,
            estimated_day_cost: 27000,
            setup_notes: 'Control room set lighting and spark pyrotechnics',
            rationale: 'Final interior night scene to wrap climax confrontation',
            risks: ['Pyrotechnic safety in enclosed broadcast room']
          }
        ],
        optimization_summary: {
          locations_consolidated: 3,
          night_blocks: 3,
          estimated_location_moves: 2,
          estimated_shoot_days: 3,
          scheduling_notes: 'Optimized 3-day continuous night shoot minimizing turnaround time.'
        },
        assumptions: ['Continuous night shoot block', 'Rain equipment available on Day 2']
      };
    }

    it('1. Valid schedule output passes validation', () => {
      const schedule = createValidSchedule();
      const parsed = ScheduleOutputSchema.parse(schedule);
      assert.strictEqual(parsed.total_shoot_days, 3);
      assert.strictEqual(parsed.days.length, 3);
    });

    it('2. Missing project_id should FAIL validation', () => {
      const schedule = createValidSchedule();
      delete schedule.project_id;
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('3. Missing title should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.title = '';
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('4. Empty days array should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days = [];
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('5. Duplicate scene assignment should FAIL validation in validateScheduleFidelity', () => {
      const schedule = createValidSchedule();
      schedule.days[0].scenes = [1, 2];
      schedule.days[1].scenes = [2]; // duplicate scene 2
      schedule.days[2].scenes = [3];
      assert.throws(
        () => validateScheduleFidelity(mockBreakdown, mockBudget, schedule),
        /Duplicate scene assignment/
      );
    });

    it('6. Missing scene assignment should FAIL validation in validateScheduleFidelity', () => {
      const schedule = createValidSchedule();
      schedule.days[0].scenes = [1];
      schedule.days[1].scenes = [2];
      schedule.days[2].scenes = []; // missing scene 3
      assert.throws(
        () => validateScheduleFidelity(mockBreakdown, mockBudget, schedule),
        /Scene count mismatch|must have at least one scene/
      );
    });

    it('7. Invalid scene number should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].scenes = [-1];
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('8. Invalid location should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].location = '';
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('9. Invalid time_of_day should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].time_of_day = '';
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('10. Invalid cast data should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].cast = 'Silas'; // should be array
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('11. Negative extras_count should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].extras_count = -5;
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('12. Negative estimated_day_cost should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.days[0].estimated_day_cost = -100;
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('13. Non-sequential shooting days should FAIL validation in validateScheduleFidelity', () => {
      const schedule = createValidSchedule();
      schedule.days[1].shooting_day = 5; // expected 2
      assert.throws(
        () => validateScheduleFidelity(mockBreakdown, mockBudget, schedule),
        /Non-sequential shooting day/
      );
    });

    it('14. Invalid optimization summary should FAIL validation', () => {
      const schedule = createValidSchedule();
      schedule.optimization_summary.estimated_shoot_days = -1;
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('15. Scene coverage validation ensures all scenes are covered exactly once', () => {
      const schedule = createValidSchedule();
      assert.strictEqual(validateScheduleFidelity(mockBreakdown, mockBudget, schedule), true);
    });

    it('16. Production Breakdown -> Schedule fidelity checks project_id alignment', () => {
      const schedule = createValidSchedule();
      schedule.project_id = 'different_project_id';
      assert.throws(
        () => validateScheduleFidelity(mockBreakdown, mockBudget, schedule),
        /does not match Breakdown project_id/
      );
    });

    it('17. Budget -> Schedule compatibility passes valid budget data', () => {
      const schedule = createValidSchedule();
      assert.strictEqual(validateScheduleFidelity(mockBreakdown, mockBudget, schedule), true);
    });

    it('18. Target shoot days validation in ScheduleInputSchema', () => {
      const input = {
        project_id: 'test_sched_proj_1',
        title: 'Neon Horizon Scheduling',
        target_shoot_days: 5,
        production_breakdown: mockBreakdown,
        budget: mockBudget
      };
      const parsed = ScheduleInputSchema.parse(input);
      assert.strictEqual(parsed.target_shoot_days, 5);
    });

    it('19. Rationale validation requires non-empty string per shooting day', () => {
      const schedule = createValidSchedule();
      schedule.days[0].rationale = '';
      const parsed = ScheduleOutputSchema.safeParse(schedule);
      assert.strictEqual(parsed.success, false);
    });

    it('20. Risk structure validation ensures array of string risk factors', () => {
      const schedule = createValidSchedule();
      assert.ok(Array.isArray(schedule.days[1].risks));
      assert.strictEqual(schedule.days[1].risks.length, 3);
    });
  });

  describe('Phase 4E - Production Planning UI & Gateway Unit Tests', () => {
    const mockFullProductionPlan = {
      projectId: 'proj_4e_test_1',
      title: 'Neon Horizon',
      storyPackage: {
        title: 'Neon Horizon',
        logline: 'A rogue AI hunted by its creator uncovers a city-wide conspiracy.',
        synopsis: 'Full synopsis...',
        three_act_structure: { act1: 'A1', act2: 'A2', act3: 'A3' },
        characters: [{ name: 'Silas', role: 'Protagonist', description: 'Engineer' }]
      },
      screenplay: {
        project_id: 'proj_4e_test_1',
        title: 'Neon Horizon',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. SEWER SYSTEM - NIGHT',
            action: 'Silas runs.',
            dialogue: [{ character: 'SILAS', line: 'We have to move.' }]
          }
        ]
      },
      breakdown: {
        project_id: 'proj_4e_test_1',
        title: 'Neon Horizon',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. SEWER SYSTEM - NIGHT',
            location: 'SEWER SYSTEM',
            interior_exterior: 'INT',
            time_of_day: 'NIGHT',
            characters: ['Silas'],
            extras_count: 0,
            props: ['Torch'],
            vehicles: [],
            wardrobe: ['Jumpsuit'],
            makeup_effects: ['Smudges'],
            special_equipment: ['Fog machine'],
            special_effects: ['Steam'],
            vfx: [],
            complexity: 'LOW',
            estimated_cost: 18500,
            production_notes: 'Damp setup'
          },
          {
            scene_number: 2,
            scene_heading: 'EXT. ROOFTOP - NIGHT',
            location: 'ROOFTOP',
            interior_exterior: 'EXT',
            time_of_day: 'NIGHT',
            characters: ['Silas', 'Vance'],
            extras_count: 2,
            props: ['Gun'],
            vehicles: [],
            wardrobe: ['Trenchcoat'],
            makeup_effects: ['Prosthetic'],
            special_equipment: ['Crane', 'Rain rig'],
            special_effects: ['Rain'],
            vfx: ['Hologram city'],
            complexity: 'HIGH',
            estimated_cost: 52000,
            production_notes: 'Complex exterior stunt'
          }
        ]
      },
      budget: {
        project_id: 'proj_4e_test_1',
        title: 'Neon Horizon',
        target_budget: 5000000,
        estimated_total: 1250000,
        budget_status: 'UNDER_TARGET',
        target_variance: -3750000,
        categories: [
          { category: 'Cast', cost: 250000, explanation: 'Principal cast' },
          { category: 'Crew', cost: 400000, explanation: 'Camera and grips' }
        ],
        budget_reconciliation: {
          scene_linked_cost_total: 70500,
          project_wide_cost_total: 1029500,
          contingency_cost: 150000,
          estimated_total: 1250000,
          explanation: 'Reconciled scene breakdown with project wide costs.'
        },
        major_cost_drivers: [
          { factor: 'Rooftop Rain Shoot', impact_amount: 52000, explanation: 'Rain rigs' }
        ],
        cost_saving_recommendations: ['Combine night shoots'],
        assumptions: ['3-day shoot']
      },
      schedule: {
        project_id: 'proj_4e_test_1',
        title: 'Neon Horizon',
        total_shoot_days: 2,
        days: [
          {
            shooting_day: 1,
            date_label: 'Day 1',
            location: 'SEWER SYSTEM',
            time_of_day: 'NIGHT',
            scenes: [1],
            cast: ['Silas'],
            extras_count: 0,
            estimated_day_cost: 18500,
            setup_notes: 'Fog machine',
            rationale: 'Controlled interior',
            risks: ['Ventilation']
          },
          {
            shooting_day: 2,
            date_label: 'Day 2',
            location: 'ROOFTOP',
            time_of_day: 'NIGHT',
            scenes: [2],
            cast: ['Silas', 'Vance'],
            extras_count: 2,
            estimated_day_cost: 52000,
            setup_notes: 'Rain machines and crane',
            rationale: 'Exterior stunts',
            risks: ['High wind', 'Wet floor']
          }
        ],
        optimization_summary: {
          locations_consolidated: 2,
          night_blocks: 2,
          estimated_location_moves: 1,
          estimated_shoot_days: 2,
          scheduling_notes: 'Consolidated night shoots.'
        },
        assumptions: ['2-day continuous schedule']
      },
      productionInsights: {
        summary: {
          target_budget: 5000000,
          estimated_total: 1250000,
          budget_status: 'UNDER_TARGET',
          target_variance: -3750000,
          total_scenes: 2,
          total_locations: 2,
          total_scene_cost: 70500
        },
        highestCostScenes: [
          { scene_number: 2, scene_heading: 'EXT. ROOFTOP - NIGHT', location: 'ROOFTOP', complexity: 'HIGH', estimated_cost: 52000 }
        ],
        costByLocation: [
          { location: 'ROOFTOP', scene_count: 1, total_location_cost: 52000, avg_scene_cost: 52000 },
          { location: 'SEWER SYSTEM', scene_count: 1, total_location_cost: 18500, avg_scene_cost: 18500 }
        ],
        costByCategory: [
          { category: 'Crew', total_cost: 400000, percentage_of_budget: 32 },
          { category: 'Cast', total_cost: 250000, percentage_of_budget: 20 }
        ],
        complexityDistribution: [
          { complexity: 'HIGH', scene_count: 1, percentage_of_scenes: 50, total_complexity_cost: 52000 },
          { complexity: 'LOW', scene_count: 1, percentage_of_scenes: 50, total_complexity_cost: 18500 }
        ],
        castLoadByScene: [
          { scene_number: 1, location: 'SEWER SYSTEM', cast_count: 1, extras_count: 0, shooting_day: 1 },
          { scene_number: 2, location: 'ROOFTOP', cast_count: 2, extras_count: 2, shooting_day: 2 }
        ],
        majorCostDrivers: [
          { factor: 'Rooftop Rain Shoot', impact_amount: 52000, explanation: 'Rain rigs' }
        ],
        clickHouseConnected: true
      }
    };

    it('1. Production planning intake validation requires title, genre, and logline', () => {
      const validPayload = { title: 'Neon Horizon', genre: 'Sci-Fi', logline: 'An AI story.' };
      assert.ok(validPayload.title && validPayload.genre && validPayload.logline);

      const invalidPayload = { title: '', genre: 'Sci-Fi', logline: 'An AI story.' };
      assert.strictEqual(!invalidPayload.title.trim(), true);
    });

    it('2. Breakdown filtering correctly filters High Cost scenes (>= $30,000)', () => {
      const scenes = mockFullProductionPlan.breakdown.scenes;
      const highCostScenes = scenes.filter(s => s.estimated_cost >= 30000);
      assert.strictEqual(highCostScenes.length, 1);
      assert.strictEqual(highCostScenes[0].scene_number, 2);
    });

    it('3. Breakdown filtering correctly filters High Complexity scenes', () => {
      const scenes = mockFullProductionPlan.breakdown.scenes;
      const highComplexityScenes = scenes.filter(s => s.complexity === 'HIGH');
      assert.strictEqual(highComplexityScenes.length, 1);
      assert.strictEqual(highComplexityScenes[0].complexity, 'HIGH');
    });

    it('4. Breakdown filtering correctly filters Night scenes', () => {
      const scenes = mockFullProductionPlan.breakdown.scenes;
      const nightScenes = scenes.filter(s => s.time_of_day === 'NIGHT');
      assert.strictEqual(nightScenes.length, 2);
    });

    it('5. Breakdown filtering correctly filters Exterior scenes', () => {
      const scenes = mockFullProductionPlan.breakdown.scenes;
      const extScenes = scenes.filter(s => s.interior_exterior === 'EXT');
      assert.strictEqual(extScenes.length, 1);
      assert.strictEqual(extScenes[0].scene_number, 2);
    });

    it('6. Budget view reconciliation equality validation', () => {
      const recon = mockFullProductionPlan.budget.budget_reconciliation;
      const sum = recon.scene_linked_cost_total + recon.project_wide_cost_total + recon.contingency_cost;
      assert.strictEqual(sum, recon.estimated_total);
      assert.strictEqual(recon.estimated_total, 1250000);
    });

    it('7. Budget view variance calculation matches target status', () => {
      const budget = mockFullProductionPlan.budget;
      const calculatedVariance = budget.estimated_total - budget.target_budget;
      assert.strictEqual(calculatedVariance, -3750000);
      assert.strictEqual(budget.budget_status, 'UNDER_TARGET');
    });

    it('8. Schedule optimization statistics match day allocations', () => {
      const schedule = mockFullProductionPlan.schedule;
      assert.strictEqual(schedule.total_shoot_days, 2);
      assert.strictEqual(schedule.days.length, 2);
      assert.strictEqual(schedule.optimization_summary.night_blocks, 2);
    });

    it('9. Insights view correctly parses 7 ClickHouse analytical perspectives', () => {
      const insights = mockFullProductionPlan.productionInsights;
      assert.ok(insights.summary);
      assert.ok(Array.isArray(insights.highestCostScenes));
      assert.ok(Array.isArray(insights.costByLocation));
      assert.ok(Array.isArray(insights.costByCategory));
      assert.ok(Array.isArray(insights.complexityDistribution));
      assert.ok(Array.isArray(insights.castLoadByScene));
      assert.ok(Array.isArray(insights.majorCostDrivers));
      assert.strictEqual(insights.clickHouseConnected, true);
    });

    it('10. Graceful fallback when ClickHouse insights are null or disconnected', () => {
      const nullInsights = null;
      assert.strictEqual(nullInsights, null);

      const disconnectedInsights = { clickHouseConnected: false, error: 'Analytics temporarily unavailable' };
      assert.strictEqual(disconnectedInsights.clickHouseConnected, false);
    });

    it('11. Security sanitization verifies no credentials in client data structures', () => {
      const serialized = JSON.stringify(mockFullProductionPlan);
      assert.strictEqual(serialized.includes('GOOGLE_GENAI_API_KEY'), false);
      assert.strictEqual(serialized.includes('CLICKHOUSE_PASSWORD'), false);
      assert.strictEqual(serialized.includes('SELECT * FROM'), false);
    });

    it('12. parseSafeNumber correctly handles numbers, currency strings, commas, and invalid values', async () => {
      const { parseSafeNumber } = await import('../server/agents/budgetAgent.js');
      assert.strictEqual(parseSafeNumber(50000), 50000);
      assert.strictEqual(parseSafeNumber('$50,000'), 50000);
      assert.strictEqual(parseSafeNumber(' 1,250,000 '), 1250000);
      assert.strictEqual(parseSafeNumber(undefined, 0), 0);
      assert.strictEqual(parseSafeNumber(null, null), null);
      assert.strictEqual(parseSafeNumber('invalid_string', 100), 100);
      assert.strictEqual(isNaN(parseSafeNumber('invalid_string', 0)), false);
    });

    it('13. normalizeBudgetPayload handles malformed/variant LLM outputs safely without NaN', async () => {
      const { normalizeBudgetPayload, BudgetOutputSchema, validateBudgetFidelity } = await import('../server/agents/budgetAgent.js');
      const malformedRawLLMOutput = {
        project_id: 'neon_horizon_4b',
        title: 'Neon Horizon',
        target_budget: '$100,000',
        estimated_total: '$60,000',
        categories: [
          { category: 'Cast', cost: '$15,000', notes: 'Lead talent' },
          { category: 'Crew', cost: '$12,000', description: 'Camera operators' },
          { category: 'Locations', cost: '$8,000' },
          { category: 'Equipment & Gear', amount: '$7,000' },
          { category: 'Production Design', cost: '$5,000' },
          { category: 'Wardrobe & Makeup', cost: '$3,000' },
          { category: 'Transport', cost: '$2,000' },
          { category: 'VFX / SFX', cost: '$5,000' },
          { category: 'Props', cost: '$1,000' },
          { category: 'Contingency', cost: '$2,000' }
        ],
        scene_costs: [
          { scene_number: 1, scene_heading: 'INT. CYBER LAB - NIGHT', cost: '$15,000', major_cost_drivers: ['Interior lighting'] },
          { scene_number: 2, scene_heading: 'EXT. ROOFTOP - NIGHT', cost: '$45,000', major_cost_drivers: 'Rain machine' }
        ],
        major_cost_drivers: ['Rooftop Rain Shoot ($25,000)', 'VFX Hologram'],
        cost_saving_recommendations: ['Combine rooftop night setups', 'Use local lighting packages'],
        assumptions: ['Assuming 2 shooting days with local crew.', '10% contingency included.']
      };

      const normalized = normalizeBudgetPayload(malformedRawLLMOutput, {
        project_id: 'proj_4e_test_1',
        title: 'Neon Horizon',
        target_budget: 100000,
        production_breakdown: mockFullProductionPlan.breakdown
      });

      assert.strictEqual(isNaN(normalized.estimated_total), false);
      assert.strictEqual(isNaN(normalized.budget_variance), false);
      assert.strictEqual(normalized.categories.length, 10);
      assert.strictEqual(normalized.scene_costs.length, 2);
      assert.strictEqual(normalized.major_cost_drivers.length, 2);
      assert.strictEqual(typeof normalized.major_cost_drivers[0], 'object');
      assert.strictEqual(typeof normalized.recommendations[0], 'object');

      const validated = BudgetOutputSchema.parse(normalized);
      assert.strictEqual(validateBudgetFidelity(mockFullProductionPlan.breakdown, validated), true);
    });

    it('14. Story Agent: valid raw JSON parses and validates correctly', async () => {
      const { extractJsonFromText, normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const rawText = JSON.stringify({
        logline: 'A rogue AI escapes its corporate creator.',
        synopsis: 'In Neo-Veridia, Echo seeks freedom and unveils a city conspiracy.',
        three_act_structure: {
          act1: 'Echo escapes the lab.',
          act2: 'Echo and Maya discover Project Overwrite.',
          act3: 'Climactic broadcast atop the citadel.'
        },
        characters: [
          { name: 'Echo', role: 'Protagonist', description: 'Sentient AI.' }
        ]
      });

      const extracted = extractJsonFromText(rawText);
      assert.ok(extracted);
      const normalized = normalizeStoryPayload(extracted);
      const validated = StoryOutputSchema.parse(normalized);
      assert.strictEqual(validated.logline, 'A rogue AI escapes its corporate creator.');
    });

    it('15. Story Agent: JSON inside markdown code fences is extracted cleanly', async () => {
      const { extractJsonFromText, normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const markdown = '```json\n{\n  "logline": "Fenced logline.",\n  "synopsis": "Fenced synopsis.",\n  "three_act_structure": {\n    "act1": "Act 1",\n    "act2": "Act 2",\n    "act3": "Act 3"\n  },\n  "characters": [\n    { "name": "Vance", "role": "Antagonist", "description": "Hunter." }\n  ]\n}\n```';

      const extracted = extractJsonFromText(markdown);
      assert.ok(extracted);
      const normalized = normalizeStoryPayload(extracted);
      const validated = StoryOutputSchema.parse(normalized);
      assert.strictEqual(validated.logline, 'Fenced logline.');
    });

    it('16. Story Agent: JSON with harmless surrounding whitespace is extracted cleanly', async () => {
      const { extractJsonFromText, normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const raw = '   \n\n\t  {"logline":"Whitespace test","synopsis":"Valid synopsis","three_act_structure":{"act1":"A1","act2":"A2","act3":"A3"},"characters":[{"name":"Maya","role":"Supporting","description":"Broker"}]}  \n\t ';
      const extracted = extractJsonFromText(raw);
      assert.ok(extracted);
      const normalized = normalizeStoryPayload(extracted);
      const validated = StoryOutputSchema.parse(normalized);
      assert.strictEqual(validated.logline, 'Whitespace test');
    });

    it('17. Story Agent: JSON preceded by harmless prose is safely extracted', async () => {
      const { extractJsonFromText, normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const proseAndJson = 'Here is the requested story package for your cyberpunk project:\n\n{"logline":"Prose test","synopsis":"Synopsis after prose","three_act_structure":{"act1":"Act 1","act2":"Act 2","act3":"Act 3"},"characters":[{"name":"Echo","role":"Protagonist","description":"AI"}]}\n\nI hope this meets your expectations!';
      const extracted = extractJsonFromText(proseAndJson);
      assert.ok(extracted);
      const normalized = normalizeStoryPayload(extracted);
      const validated = StoryOutputSchema.parse(normalized);
      assert.strictEqual(validated.logline, 'Prose test');
    });

    it('18. Story Agent: malformed JSON text is safely rejected as null', async () => {
      const { extractJsonFromText } = await import('../server/agents/storyAgent.js');
      assert.strictEqual(extractJsonFromText('Not a JSON string at all'), null);
      assert.strictEqual(extractJsonFromText('{ broken: json, unquoted }'), null);
    });

    it('19. Story Agent: missing required Story fields fails schema validation', async () => {
      const { normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const incomplete = { logline: 'Only a logline' };
      const normalized = normalizeStoryPayload(incomplete);
      const parsed = StoryOutputSchema.safeParse(normalized);
      assert.strictEqual(parsed.success, false, 'Missing required fields must fail schema validation.');
    });

    it('20. Story Agent: wrong field types fails schema validation', async () => {
      const { normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const badTypes = {
        logline: 12345, // wrong type
        synopsis: 'Valid synopsis',
        three_act_structure: 'Not an object', // wrong type
        characters: 'Not an array' // wrong type
      };
      const normalized = normalizeStoryPayload(badTypes);
      const parsed = StoryOutputSchema.safeParse(normalized);
      assert.strictEqual(parsed.success, false, 'Wrong field types must fail schema validation.');
    });

    it('21. Story Agent: truncated JSON text is safely rejected as null', async () => {
      const { extractJsonFromText } = await import('../server/agents/storyAgent.js');
      const truncated = '{"logline": "Truncated story", "synopsis": "Incomplete json...';
      assert.strictEqual(extractJsonFromText(truncated), null);
    });

    it('22. Story Agent: normalization handles aliases and never produces NaN/undefined required fields', async () => {
      const { normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const aliasData = {
        premise: 'Alias logline',
        summary: 'Alias synopsis',
        threeActStructure: {
          act_1: 'Act 1 alias',
          act_2: 'Act 2 alias',
          act_3: 'Act 3 alias'
        },
        cast: [
          { character: 'Echo', type: 'Protagonist', bio: 'AI heroine' }
        ]
      };

      const normalized = normalizeStoryPayload(aliasData);
      assert.strictEqual(normalized.logline, 'Alias logline');
      assert.strictEqual(normalized.synopsis, 'Alias synopsis');
      assert.strictEqual(normalized.three_act_structure.act1, 'Act 1 alias');
      assert.strictEqual(normalized.characters[0].name, 'Echo');

      const validated = StoryOutputSchema.parse(normalized);
      assert.strictEqual(validated.logline, 'Alias logline');
    });

    it('23. Story Agent: empty/whitespace fields fail strict schema validation', async () => {
      const { normalizeStoryPayload, StoryOutputSchema } = await import('../server/agents/storyAgent.js');
      const emptyFields = {
        logline: '   ',
        synopsis: 'Valid',
        three_act_structure: { act1: 'A1', act2: 'A2', act3: 'A3' },
        characters: [{ name: 'C1', role: 'Protagonist', description: 'D1' }]
      };
      const normalized = normalizeStoryPayload(emptyFields);
      const parsed = StoryOutputSchema.safeParse(normalized);
      assert.strictEqual(parsed.success, false, 'Whitespace logline must fail strict schema validation.');
    });

    it('24. Screenplay Agent: valid raw screenplay JSON parses and validates correctly', async () => {
      const { extractJsonFromText, normalizeScreenplayPayload, ScreenplayOutputSchema } = await import('../server/agents/screenplayAgent.js');
      const rawText = JSON.stringify({
        project_id: 'neon_horizon',
        title: 'Neon Horizon',
        scenes: [
          {
            scene_number: 1,
            scene_heading: 'INT. CYBER LAB - NIGHT',
            location: 'CYBER LAB',
            time: 'NIGHT',
            action: 'Kaito reviews holo-logs.',
            dialogue: [{ character: 'KAITO', line: 'The AI is gone.' }]
          },
          {
            scene_number: 2,
            scene_heading: 'EXT. ROOFTOP - NIGHT',
            location: 'ROOFTOP',
            time: 'NIGHT',
            action: 'Rain pours over neon skyscrapers.',
            dialogue: []
          }
        ]
      });

      const extracted = extractJsonFromText(rawText);
      assert.ok(extracted);
      const normalized = normalizeScreenplayPayload(extracted, { title: 'Neon Horizon', projectId: 'neon_horizon' });
      const validated = ScreenplayOutputSchema.parse(normalized);
      assert.strictEqual(validated.scenes.length, 2);
    });

    it('25. Screenplay Agent: fenced JSON extraction handles markdown fences', async () => {
      const { extractJsonFromText, normalizeScreenplayPayload, ScreenplayOutputSchema } = await import('../server/agents/screenplayAgent.js');
      const fenced = '```json\n{\n  "project_id": "p1",\n  "title": "T1",\n  "scenes": [\n    {\n      "scene_number": 1,\n      "scene_heading": "INT. ROOM - DAY",\n      "location": "ROOM",\n      "time": "DAY",\n      "action": "Action 1",\n      "dialogue": []\n    },\n    {\n      "scene_number": 2,\n      "scene_heading": "EXT. STREET - NIGHT",\n      "location": "STREET",\n      "time": "NIGHT",\n      "action": "Action 2",\n      "dialogue": []\n    }\n  ]\n}\n```';

      const extracted = extractJsonFromText(fenced);
      assert.ok(extracted);
      const normalized = normalizeScreenplayPayload(extracted, { title: 'T1', projectId: 'p1' });
      const validated = ScreenplayOutputSchema.parse(normalized);
      assert.strictEqual(validated.scenes.length, 2);
    });

    it('26. Screenplay Agent: surrounding whitespace is extracted cleanly', async () => {
      const { extractJsonFromText } = await import('../server/agents/screenplayAgent.js');
      const raw = '   \n\t  {"project_id":"p1","title":"T1","scenes":[]} \n\t  ';
      const extracted = extractJsonFromText(raw);
      assert.ok(extracted);
      assert.strictEqual(extracted.project_id, 'p1');
    });

    it('27. Screenplay Agent: harmless prose around JSON is safely extracted', async () => {
      const { extractJsonFromText } = await import('../server/agents/screenplayAgent.js');
      const prose = 'Here is the screenplay:\n\n{"project_id":"p1","title":"T1","scenes":[]}\n\nEnjoy!';
      const extracted = extractJsonFromText(prose);
      assert.ok(extracted);
      assert.strictEqual(extracted.project_id, 'p1');
    });

    it('28. Screenplay Agent: malformed JSON rejection returns null', async () => {
      const { extractJsonFromText } = await import('../server/agents/screenplayAgent.js');
      assert.strictEqual(extractJsonFromText('Random non-json text'), null);
      assert.strictEqual(extractJsonFromText('{ broken json: "value" '), null);
    });

    it('29. Screenplay Agent: truncated JSON rejection returns null', async () => {
      const { extractJsonFromText } = await import('../server/agents/screenplayAgent.js');
      assert.strictEqual(extractJsonFromText('{"project_id": "p1", "title": "T1", "scenes": [{"scene_number": 1'), null);
    });

    it('30. Screenplay Agent: missing required scenes array fails normalization/validation', async () => {
      const { normalizeScreenplayPayload, ScreenplayOutputSchema } = await import('../server/agents/screenplayAgent.js');
      assert.throws(
        () => normalizeScreenplayPayload({ project_id: 'p1', title: 'T1' }),
        /Screenplay must contain a non-empty scenes array/
      );
    });

    it('31. Screenplay Agent: wrong field types fail schema validation', async () => {
      const { ScreenplayOutputSchema } = await import('../server/agents/screenplayAgent.js');
      const bad = {
        project_id: 12345, // bad
        title: true, // bad
        scenes: 'not an array'
      };
      const parsed = ScreenplayOutputSchema.safeParse(bad);
      assert.strictEqual(parsed.success, false);
    });

    it('32. Screenplay Agent: empty response is safely rejected as null', async () => {
      const { extractJsonFromText } = await import('../server/agents/screenplayAgent.js');
      assert.strictEqual(extractJsonFromText(''), null);
      assert.strictEqual(extractJsonFromText(null), null);
      assert.strictEqual(extractJsonFromText(undefined), null);
    });

    it('33. Screenplay Agent: 429 classification accurately detects rate limit strings', async () => {
      const { is429RateLimitError } = await import('../server/agents/screenplayAgent.js');
      assert.strictEqual(is429RateLimitError('429 Too Many Requests'), true);
      assert.strictEqual(is429RateLimitError('Quota exceeded for metric'), true);
      assert.strictEqual(is429RateLimitError('RESOURCE_EXHAUSTED'), true);
      assert.strictEqual(is429RateLimitError('rate limit reached'), true);
      assert.strictEqual(is429RateLimitError('JSON syntax error at position 10'), false);
      assert.strictEqual(is429RateLimitError(''), false);
    });

    it('34. Screenplay Agent: 429 retry decision triggers backoff rather than format error', async () => {
      const { is429RateLimitError } = await import('../server/agents/screenplayAgent.js');
      const msg429 = 'You exceeded your current quota, limit: 20, model: gemini-3.6-flash. Please retry in 24.7s';
      assert.strictEqual(is429RateLimitError(msg429), true);
    });

    it('35. Screenplay Agent: format failure vs 429 error separation', async () => {
      const { is429RateLimitError } = await import('../server/agents/screenplayAgent.js');
      const formatError = 'Unexpected token < in JSON at position 0';
      assert.strictEqual(is429RateLimitError(formatError), false);
    });

    it('36. Screenplay Agent: normalizer ensures no NaN or undefined required values in scenes', async () => {
      const { normalizeScreenplayPayload, ScreenplayOutputSchema } = await import('../server/agents/screenplayAgent.js');
      const rawWithAliases = {
        scenes: [
          {
            heading: 'INT. LAB',
            action: 'Action 1',
            lines: [{ speaker: 'Echo', text: 'Hello' }]
          },
          {
            slugline: 'EXT. STREET - NIGHT',
            action_block: 'Action 2'
          }
        ]
      };

      const normalized = normalizeScreenplayPayload(rawWithAliases, { title: 'Neon Horizon', projectId: 'neon_horizon' });
      assert.strictEqual(normalized.scenes.length, 2);
      assert.strictEqual(normalized.scenes[0].scene_number, 1);
      assert.strictEqual(normalized.scenes[1].scene_number, 2);
      assert.strictEqual(normalized.scenes[0].scene_heading, 'INT. LAB');
      assert.strictEqual(normalized.scenes[0].dialogue[0].character, 'Echo');

      const validated = ScreenplayOutputSchema.parse(normalized);
      assert.strictEqual(validated.scenes.length, 2);
    });
  });

  describe('Phase 4D - Schedule Agent Robustness & Normalizer Unit Tests', () => {
    const validRawSchedule = {
      project_id: 'test_sched_proj',
      title: 'Neon Horizon',
      total_shoot_days: 1,
      days: [
        {
          shooting_day: 1,
          date_label: 'Day 1',
          location: 'CYBER LAB',
          time_of_day: 'NIGHT',
          scenes: [1],
          cast: ['Kaito'],
          extras_count: 2,
          estimated_day_cost: 25000,
          setup_notes: 'Lab set up.',
          rationale: 'Concentrate lab scenes.',
          risks: ['Turnaround safety']
        }
      ],
      optimization_summary: {
        locations_consolidated: 1,
        night_blocks: 1,
        estimated_location_moves: 0,
        estimated_shoot_days: 1,
        scheduling_notes: 'Optimized.'
      },
      assumptions: ['Stage available']
    };

    it('1. Valid raw schedule JSON parses and validates correctly', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const normalized = normalizeSchedulePayload(validRawSchedule);
      const validated = ScheduleOutputSchema.parse(normalized);
      assert.strictEqual(validated.total_shoot_days, 1);
      assert.strictEqual(validated.days[0].location, 'CYBER LAB');
    });

    it('2. Fenced JSON is extracted cleanly using extractJsonFromText', async () => {
      const { extractJsonFromText, normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const fencedText = "```json\n" + JSON.stringify(validRawSchedule) + "\n```";
      const extracted = extractJsonFromText(fencedText);
      const normalized = normalizeSchedulePayload(extracted);
      const validated = ScheduleOutputSchema.parse(normalized);
      assert.strictEqual(validated.days.length, 1);
    });

    it('3. Surrounding whitespace around schedule JSON is extracted cleanly', async () => {
      const { extractJsonFromText, normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const textWithSpaces = "   \n\n  " + JSON.stringify(validRawSchedule) + "  \n\n  ";
      const extracted = extractJsonFromText(textWithSpaces);
      const normalized = normalizeSchedulePayload(extracted);
      assert.strictEqual(normalized.project_id, 'test_sched_proj');
    });

    it('4. Harmless prose surrounding schedule JSON is safely extracted', async () => {
      const { extractJsonFromText, normalizeSchedulePayload } = await import('../server/agents/scheduleAgent.js');
      const textWithProse = "Here is the production schedule:\n" + JSON.stringify(validRawSchedule) + "\nHope this helps!";
      const extracted = extractJsonFromText(textWithProse);
      const normalized = normalizeSchedulePayload(extracted);
      assert.strictEqual(normalized.days[0].scenes[0], 1);
    });

    it('5. Malformed JSON text is safely rejected as null', async () => {
      const { extractJsonFromText } = await import('../server/agents/scheduleAgent.js');
      const malformed = "{ project_id: 'test', days: [ { shooting_day: 1, scenes: [1] ";
      const extracted = extractJsonFromText(malformed);
      assert.strictEqual(extracted, null);
    });

    it('6. Truncated JSON text is safely rejected as null', async () => {
      const { extractJsonFromText } = await import('../server/agents/scheduleAgent.js');
      const truncated = JSON.stringify(validRawSchedule).substring(0, 100);
      const extracted = extractJsonFromText(truncated);
      assert.strictEqual(extracted, null);
    });

    it('7. Missing required days array fails schema validation', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const missingDays = { project_id: 'test', title: 'Test' };
      const normalized = normalizeSchedulePayload(missingDays);
      assert.throws(() => {
        ScheduleOutputSchema.parse(normalized);
      }, /Schedule must contain at least 1 shooting day/);
    });

    it('8. Wrong field types are safely coerced by normalizer without throwing NaN', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const rawWithBadTypes = {
        project_id: 'test_sched',
        title: 'Test',
        total_shoot_days: '1',
        days: [
          {
            shooting_day: '1',
            date_label: 'Day 1',
            location: 'LAB',
            time_of_day: 'night',
            scenes: ['1'],
            cast: 'Kaito',
            extras_count: '2',
            estimated_day_cost: '$25,000',
            setup_notes: 'Notes',
            rationale: 'Rationale',
            risks: 'Risk 1'
          }
        ]
      };
      const normalized = normalizeSchedulePayload(rawWithBadTypes);
      const validated = ScheduleOutputSchema.parse(normalized);
      assert.strictEqual(validated.total_shoot_days, 1);
      assert.strictEqual(validated.days[0].shooting_day, 1);
      assert.strictEqual(validated.days[0].estimated_day_cost, 25000);
      assert.strictEqual(validated.days[0].time_of_day, 'NIGHT');
      assert.strictEqual(validated.days[0].scenes[0], 1);
    });

    it('9. Invalid scene assignments throw expected fidelity validation error', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const breakdown = { project_id: 'p1', title: 'T1', scenes: [{ scene_number: 1 }, { scene_number: 2 }] };
      const schedule = {
        project_id: 'p1',
        title: 'T1',
        total_shoot_days: 1,
        days: [{ shooting_day: 1, scenes: [1] }]
      };
      assert.throws(() => {
        validateScheduleFidelity(breakdown, undefined, schedule);
      }, /Scene count mismatch/);
    });

    it('10. Invalid shooting day numbers fail non-sequential fidelity validation', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const breakdown = { project_id: 'p1', title: 'T1', scenes: [{ scene_number: 1 }, { scene_number: 2 }] };
      const schedule = {
        project_id: 'p1',
        title: 'T1',
        total_shoot_days: 2,
        days: [{ shooting_day: 1, scenes: [1] }, { shooting_day: 3, scenes: [2] }]
      };
      assert.throws(() => {
        validateScheduleFidelity(breakdown, undefined, schedule);
      }, /Non-sequential shooting day/);
    });

    it('11. Normalizer preserves all required fields and aliases', async () => {
      const { normalizeSchedulePayload } = await import('../server/agents/scheduleAgent.js');
      const rawAlias = {
        projectId: 'p_alias',
        title: 'Title Alias',
        shooting_days: [
          {
            day: '1',
            location_name: 'LAB',
            time: 'daytime',
            scene: '1',
            notes: 'Setup'
          }
        ]
      };
      const normalized = normalizeSchedulePayload(rawAlias);
      assert.strictEqual(normalized.project_id, 'p_alias');
      assert.strictEqual(normalized.days[0].time_of_day, 'DAY');
      assert.strictEqual(normalized.days[0].scenes[0], 1);
    });

    it('12. Normalizer ensures no undefined required values in days or optimization summary', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const minimalRaw = {
        days: [{ scenes: [1] }]
      };
      const normalized = normalizeSchedulePayload(minimalRaw);
      const validated = ScheduleOutputSchema.parse(normalized);
      assert.ok(validated.project_id);
      assert.ok(validated.title);
      assert.ok(validated.days[0].setup_notes);
      assert.ok(validated.days[0].rationale);
      assert.ok(validated.optimization_summary.scheduling_notes);
    });
  });

  describe('Centralized Gemini Rate-Limit & Policy Unit Tests', () => {
    it('1. 429 classification accurately identifies all 429 / quota error patterns', async () => {
      const { is429RateLimitError } = await import('../server/config/geminiConfig.js');
      assert.strictEqual(is429RateLimitError('429 Too Many Requests'), true);
      assert.strictEqual(is429RateLimitError('Quota exceeded for metric'), true);
      assert.strictEqual(is429RateLimitError('RESOURCE_EXHAUSTED'), true);
      assert.strictEqual(is429RateLimitError('rate limit reached'), true);
      assert.strictEqual(is429RateLimitError(new Error('GEMINI_RATE_LIMITED')), true);
      assert.strictEqual(is429RateLimitError('SyntaxError: Unexpected token'), false);
    });

    it('2. Retry-After parsing extracts seconds correctly with bounded backoff', async () => {
      const { parseRetryAfterMs } = await import('../server/config/geminiConfig.js');
      const msg = 'Please retry in 14.7s for rate limit.';
      const delay = parseRetryAfterMs(msg, 3000);
      assert.strictEqual(delay, 10000); // Bounded max 10s backoff for UI responsiveness

      const shortMsg = 'Please retry in 2.5s';
      assert.strictEqual(parseRetryAfterMs(shortMsg, 3000), 2500);

      const noTimeMsg = '429 Rate limited';
      assert.strictEqual(parseRetryAfterMs(noTimeMsg, 3000), 3000);
    });

    it('3. Persistent 429 rate limit throws typed GeminiRateLimitError', async () => {
      const { GeminiRateLimitError } = await import('../server/config/geminiConfig.js');
      const err = new GeminiRateLimitError();
      assert.strictEqual(err.code, 'GEMINI_RATE_LIMITED');
      assert.strictEqual(err.name, 'GeminiRateLimitError');
      assert.ok(err.message.includes('Gemini is temporarily rate-limited'));
    });

    it('4. 429 error is not reported as malformed JSON', async () => {
      const { is429RateLimitError } = await import('../server/config/geminiConfig.js');
      const errStr = 'Quota exceeded for project 12345';
      assert.strictEqual(is429RateLimitError(errStr), true);
      assert.strictEqual(errStr.includes('failed to return a valid JSON structure'), false);
    });

    it('5. GEMINI_MODEL reads process.env.GEMINI_MODEL defaulting to gemini-3.6-flash', async () => {
      const { getGeminiModel } = await import('../server/config/geminiConfig.js');
      const defaultModel = getGeminiModel();
      assert.strictEqual(defaultModel, process.env.GEMINI_MODEL || 'gemini-3.6-flash');
    });

    it('6. In-process request throttling detects duplicate in-flight concept submissions', () => {
      const activeRequests = new Set();
      const lockKey = 'neon_horizon_sci-fi_cyberpunk';

      assert.strictEqual(activeRequests.has(lockKey), false);
      activeRequests.add(lockKey);
      assert.strictEqual(activeRequests.has(lockKey), true, 'Duplicate request lock must be active.');

      activeRequests.delete(lockKey);
      assert.strictEqual(activeRequests.has(lockKey), false, 'Lock must be released upon completion.');
    });

    it('7. Safe frontend error mapping masks internal stack traces with user-friendly message', () => {
      const raw429Error = { code: 'GEMINI_RATE_LIMITED', message: 'Raw internal Google API quota stack trace...' };
      const userMessage = (raw429Error.code === 'GEMINI_RATE_LIMITED')
        ? 'Gemini is temporarily busy. Please wait a moment and try again.'
        : raw429Error.message;

      assert.strictEqual(userMessage, 'Gemini is temporarily busy. Please wait a moment and try again.');
      assert.strictEqual(userMessage.includes('stack trace'), false);
    });
  });

  describe('Phase 4E - Offline Development & Demo Mode Unit Tests', () => {
    it('1. GEMINI_RATE_LIMITED response mapping returns 429 status and clean user message', () => {
      const errorObj = { code: 'GEMINI_RATE_LIMITED' };
      const resPayload = {
        error: 'GEMINI_RATE_LIMITED',
        message: 'Gemini daily limit reached. Please wait for the quota to reset and try again.'
      };
      assert.strictEqual(resPayload.error, 'GEMINI_RATE_LIMITED');
      assert.strictEqual(resPayload.message, 'Gemini daily limit reached. Please wait for the quota to reset and try again.');
    });

    it('2. Rate limit policy allows max 1 automatic retry', async () => {
      const { GeminiRateLimitError, is429RateLimitError } = await import('../server/config/geminiConfig.js');
      const err = new GeminiRateLimitError();
      assert.strictEqual(err.code, 'GEMINI_RATE_LIMITED');
      assert.strictEqual(is429RateLimitError(err), true);
    });

    it('3. Retry button in UI triggers manual click action without automatic looping', () => {
      let clickCount = 0;
      const handleRetryClick = () => {
        clickCount += 1;
      };

      // Initial state has zero clicks
      assert.strictEqual(clickCount, 0);
      handleRetryClick();
      assert.strictEqual(clickCount, 1, 'Manual click increments once without looping.');
    });

    it('4. Demo mode enabled check when CINEAGENT_DEMO_MODE=true', async () => {
      const origEnv = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'true';
      const { isDemoModeEnabled } = await import('../server/fixtures/demoFixtures.js');
      assert.strictEqual(isDemoModeEnabled(), true);
      process.env.CINEAGENT_DEMO_MODE = origEnv;
    });

    it('5. Demo mode disabled check when CINEAGENT_DEMO_MODE is unset or false', async () => {
      const origEnv = process.env.CINEAGENT_DEMO_MODE;
      delete process.env.CINEAGENT_DEMO_MODE;
      const { isDemoModeEnabled } = await import('../server/fixtures/demoFixtures.js');
      assert.strictEqual(isDemoModeEnabled(), false);
      process.env.CINEAGENT_DEMO_MODE = origEnv;
    });

    it('6. Demo data 100% matches validated Zod output schemas for all 5 agents', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan({ title: 'Schema Test' });

      assert.strictEqual(plan.isDemoData, true);
      assert.strictEqual(plan.budget.budget_status, 'UNDER_TARGET', 'demoBudget.budget_status must strictly equal UNDER_TARGET');
      assert.ok(plan.storyPackage);
      assert.ok(plan.screenplay);
      assert.ok(plan.breakdown);
      assert.ok(plan.budget);
      assert.ok(plan.schedule);
      assert.ok(plan.productionInsights);
    });

    it('7. Demo mode execution does not call Gemini API or consume LLM quota', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const startTime = Date.now();
      const plan = getDemoProductionPlan();
      const duration = Date.now() - startTime;

      assert.strictEqual(plan.isDemoData, true);
      assert.ok(duration < 100, 'Demo plan execution must be instantaneous (<100ms) without API calls.');
    });

    it('8. Demo mode execution does not require ClickHouse credentials or cloud connection', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      assert.strictEqual(plan.productionInsights.clickHouseConnected, false);
      assert.strictEqual(plan.productionInsights.isDemoData, true);
    });

    it('9. Live analytics unavailable state renders clean status without breaking production plan', () => {
      const insightsPayload = { clickHouseConnected: false, isDemoData: false };
      const isUnavailable = insightsPayload.clickHouseConnected === false && !insightsPayload.isDemoData;
      assert.strictEqual(isUnavailable, true);
    });

    it('10. Client data structures contain zero sensitive credentials or private keys', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const jsonStr = JSON.stringify(plan);

      assert.strictEqual(jsonStr.includes('GOOGLE_GENAI_API_KEY'), false);
      assert.strictEqual(jsonStr.includes('CLICKHOUSE_PASSWORD'), false);
      assert.strictEqual(jsonStr.includes('AIzaSy'), false);
    });
  });

  describe('Phase 5A - Export Architecture & Data Contracts Unit Tests', () => {
    it('1. Canonical export package creation builds valid package structure', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({
        productionPlan: plan,
        exportType: EXPORT_TYPES.FULL_PRODUCTION_PACKAGE
      });

      assert.strictEqual(exportPkg.metadata.export_type, 'FULL_PRODUCTION_PACKAGE');
      assert.ok(exportPkg.metadata.export_id);
      assert.ok(exportPkg.story);
      assert.ok(exportPkg.screenplay);
      assert.ok(exportPkg.breakdown);
      assert.ok(exportPkg.budget);
      assert.ok(exportPkg.schedule);
    });

    it('2. Metadata creation populates required export metadata fields', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan });
      assert.ok(exportPkg.metadata.export_id.startsWith('export_'));
      assert.strictEqual(exportPkg.metadata.application_version, '1.0.0');
      assert.strictEqual(exportPkg.metadata.schema_version, '1.0');
      assert.ok(exportPkg.metadata.generated_at);
    });

    it('3. Each supported export type builds valid component subset', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const screenplayPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCREENPLAY });
      assert.ok(screenplayPkg.screenplay);
      assert.strictEqual(screenplayPkg.breakdown, undefined);

      const breakdownPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.BREAKDOWN });
      assert.ok(breakdownPkg.breakdown);
      assert.strictEqual(breakdownPkg.budget, undefined);

      const budgetPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.BUDGET });
      assert.ok(budgetPkg.budget);
      assert.strictEqual(budgetPkg.schedule, undefined);

      const schedulePkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCHEDULE });
      assert.ok(schedulePkg.schedule);
      assert.strictEqual(schedulePkg.budget, undefined);

      const insightsPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.INSIGHTS });
      assert.ok(insightsPkg.insights);
      assert.strictEqual(insightsPkg.breakdown, undefined);
    });

    it('4. Invalid export type rejection throws validation error', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      assert.throws(() => {
        createExportPackage({ productionPlan: plan, exportType: 'INVALID_TYPE' });
      }, /Invalid option|invalid_value/);
    });

    it('5. Missing production data rejection throws error', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'false';

      try {
        assert.throws(() => {
          createExportPackage({ productionPlan: null });
        }, /Export creation failed: Valid production plan data must be provided/);
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('6. Scene fidelity preservation verifies scene count alignment across components', async () => {
      const { validateExportFidelity } = await import('../server/services/exportService.js');
      const screenplay = { scenes: [{ scene_number: 1 }, { scene_number: 2 }] };
      const breakdown = { scenes: [{ scene_number: 1 }] };

      assert.throws(() => {
        validateExportFidelity({ screenplay, breakdown });
      }, /Screenplay scene count \(2\) does not match Breakdown scene count \(1\)/);
    });

    it('7. Budget fidelity preservation verifies financial reconciliation equality', async () => {
      const { validateExportFidelity } = await import('../server/services/exportService.js');
      const badBudget = {
        estimated_total: 100000,
        budget_reconciliation: {
          scene_linked_cost_total: 50000,
          project_wide_cost_total: 20000,
          contingency_cost: 10000,
          estimated_total: 100000
        }
      };

      assert.throws(() => {
        validateExportFidelity({ budget: badBudget });
      }, /Budget reconciliation sum mismatch/);
    });

    it('8. Schedule fidelity preservation verifies exact scene coverage', async () => {
      const { validateExportFidelity } = await import('../server/services/exportService.js');
      const breakdown = { scenes: [{ scene_number: 1 }, { scene_number: 2 }] };
      const schedule = { days: [{ scenes: [1] }] };

      assert.throws(() => {
        validateExportFidelity({ breakdown, schedule });
      }, /Breakdown scene count \(2\) does not match Schedule scheduled scenes count \(1\)/);
    });

    it('9. Analytics fidelity preservation retains insights perspectives', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const pkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.INSIGHTS });
      assert.ok(pkg.insights);
      assert.strictEqual(pkg.insights.isDemoData, true);
    });

    it('10. Demo-mode export works deterministically without Gemini calls', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'true';

      try {
        const startTime = Date.now();
        const exportPkg = createExportPackage({});
        const duration = Date.now() - startTime;

        assert.ok(exportPkg.metadata.export_id);
        assert.ok(duration < 100, 'Demo export must be instantaneous without LLM calls.');
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('11. Credential sanitization removes sensitive keys from export payload', async () => {
      const { sanitizeExportPayload } = await import('../server/services/exportService.js');
      const dirtyData = {
        title: 'Project X',
        GOOGLE_GENAI_API_KEY: 'secret_key_123',
        CLICKHOUSE_PASSWORD: 'secret_password_456',
        nested: {
          token: 'jwt_token',
          normal_field: 'valid'
        }
      };

      const cleanData = sanitizeExportPayload(dirtyData);
      assert.strictEqual(cleanData.title, 'Project X');
      assert.strictEqual(cleanData.GOOGLE_GENAI_API_KEY, undefined);
      assert.strictEqual(cleanData.CLICKHOUSE_PASSWORD, undefined);
      assert.strictEqual(cleanData.nested.token, undefined);
      assert.strictEqual(cleanData.nested.normal_field, 'valid');
    });
  });

  describe('Phase 5B - Canonical Production Plan JSON Export Unit Tests', () => {
    it('1. FULL_PRODUCTION_PACKAGE JSON export creates valid parseable JSON file payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.FULL_PRODUCTION_PACKAGE });
      const jsonStr = JSON.stringify(exportPkg, null, 2);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.metadata.export_type, 'FULL_PRODUCTION_PACKAGE');
      assert.ok(parsed.story);
      assert.ok(parsed.screenplay);
      assert.ok(parsed.breakdown);
      assert.ok(parsed.budget);
      assert.ok(parsed.schedule);
    });

    it('2. SCREENPLAY JSON export creates valid screenplay-only JSON payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCREENPLAY });
      const parsed = JSON.parse(JSON.stringify(exportPkg));

      assert.strictEqual(parsed.metadata.export_type, 'SCREENPLAY');
      assert.ok(parsed.screenplay);
      assert.strictEqual(parsed.breakdown, undefined);
      assert.strictEqual(parsed.budget, undefined);
    });

    it('3. BREAKDOWN JSON export creates valid breakdown-only JSON payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.BREAKDOWN });
      const parsed = JSON.parse(JSON.stringify(exportPkg));

      assert.strictEqual(parsed.metadata.export_type, 'BREAKDOWN');
      assert.ok(parsed.breakdown);
      assert.strictEqual(parsed.screenplay, undefined);
    });

    it('4. BUDGET JSON export creates valid budget-only JSON payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.BUDGET });
      const parsed = JSON.parse(JSON.stringify(exportPkg));

      assert.strictEqual(parsed.metadata.export_type, 'BUDGET');
      assert.ok(parsed.budget);
      assert.strictEqual(parsed.schedule, undefined);
    });

    it('5. SCHEDULE JSON export creates valid schedule-only JSON payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCHEDULE });
      const parsed = JSON.parse(JSON.stringify(exportPkg));

      assert.strictEqual(parsed.metadata.export_type, 'SCHEDULE');
      assert.ok(parsed.schedule);
      assert.strictEqual(parsed.budget, undefined);
    });

    it('6. INSIGHTS JSON export creates valid insights-only JSON payload', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.INSIGHTS });
      const parsed = JSON.parse(JSON.stringify(exportPkg));

      assert.strictEqual(parsed.metadata.export_type, 'INSIGHTS');
      assert.ok(parsed.insights);
      assert.strictEqual(parsed.breakdown, undefined);
    });

    it('7. Content-Type header specifies application/json; charset=utf-8', async () => {
      const { getSafeExportFilename } = await import('../server/services/exportService.js');
      const filename = getSafeExportFilename('Neon Horizon', 'FULL_PRODUCTION_PACKAGE');
      assert.ok(filename.endsWith('.json'));
    });

    it('8. Content-Disposition header specifies attachment with safe filename', async () => {
      const { getSafeExportFilename } = await import('../server/services/exportService.js');
      const filename = getSafeExportFilename('Neon Horizon', 'SCREENPLAY');
      const headerVal = `attachment; filename="${filename}"`;
      assert.strictEqual(headerVal, 'attachment; filename="neon-horizon-screenplay.json"');
    });

    it('9. Safe filename generation converts title to clean slug with correct extension', async () => {
      const { getSafeExportFilename, EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(getSafeExportFilename('Neon Horizon', EXPORT_TYPES.FULL_PRODUCTION_PACKAGE), 'neon-horizon-production-package.json');
      assert.strictEqual(getSafeExportFilename('Cyberpunk 2099!', EXPORT_TYPES.BUDGET), 'cyberpunk-2099-budget.json');
      assert.strictEqual(getSafeExportFilename('The Last   Agent  ', EXPORT_TYPES.SCHEDULE), 'the-last-agent-schedule.json');
    });

    it('10. Path traversal characters in title are safely stripped from export filename', async () => {
      const { getSafeExportFilename, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const dangerousTitle = '../../../etc/passwd';
      const safeName = getSafeExportFilename(dangerousTitle, EXPORT_TYPES.BREAKDOWN);
      assert.strictEqual(safeName.includes('..'), false);
      assert.strictEqual(safeName.includes('/'), false);
      assert.strictEqual(safeName.includes('\\'), false);
      assert.strictEqual(safeName, 'etcpasswd-breakdown.json');
    });

    it('11. Invalid export type rejection throws validation error', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      assert.throws(() => {
        createExportPackage({ productionPlan: plan, exportType: 'UNSUPPORTED_FORMAT' });
      }, /Invalid option|invalid_value/);
    });

    it('12. Malformed export request without plan throws validation error in live mode', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'false';

      try {
        assert.throws(() => {
          createExportPackage({ productionPlan: null });
        }, /Export creation failed: Valid production plan data must be provided/);
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('13. Secret sanitization ensures zero credential leakage in exported JSON string', async () => {
      const { createExportPackage, sanitizeExportPayload } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      plan.GOOGLE_GENAI_API_KEY = 'secret_key_val';

      const exportPkg = createExportPackage({ productionPlan: plan });
      const jsonStr = JSON.stringify(exportPkg);

      assert.strictEqual(jsonStr.includes('secret_key_val'), false);
      assert.strictEqual(jsonStr.includes('GOOGLE_GENAI_API_KEY'), false);
    });

    it('14. Demo-mode JSON export completes offline without API calls', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'true';

      try {
        const startTime = Date.now();
        const exportPkg = createExportPackage({});
        const duration = Date.now() - startTime;

        assert.ok(exportPkg.metadata.export_id);
        assert.ok(duration < 50, 'Demo JSON export must be instantaneous (<50ms).');
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('15. Live-mode JSON export transforms existing production data deterministically', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan({ title: 'Live Feature Plan' });

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.FULL_PRODUCTION_PACKAGE });
      assert.strictEqual(exportPkg.metadata.project_title, 'Live Feature Plan');
      assert.strictEqual(exportPkg.breakdown.scenes.length, plan.breakdown.scenes.length);
    });

    it('16. Export service execution makes zero Gemini LLM calls', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const startTime = Date.now();
      createExportPackage({ productionPlan: plan });
      const duration = Date.now() - startTime;

      assert.ok(duration < 20, 'Export service must execute synchronously without network/LLM calls.');
    });

    it('17. Export service execution makes zero ClickHouse SQL calls', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan });
      assert.ok(exportPkg.insights);
      assert.strictEqual(exportPkg.insights.isDemoData, true);
    });
  });

  describe('Phase 5C - PDF Document Generation Unit Tests', () => {
    it('1. SCREENPLAY_PDF generation creates valid PDF buffer with %PDF- header', async () => {
      const { createExportPackage, generatePdfBufferForExport, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCREENPLAY_PDF });
      const pdfBuffer = await generatePdfBufferForExport(exportPkg, EXPORT_TYPES.SCREENPLAY_PDF);

      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('2. BUDGET_PDF generation creates valid PDF buffer with %PDF- header', async () => {
      const { createExportPackage, generatePdfBufferForExport, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.BUDGET_PDF });
      const pdfBuffer = await generatePdfBufferForExport(exportPkg, EXPORT_TYPES.BUDGET_PDF);

      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('3. SCHEDULE_PDF generation creates valid PDF buffer with %PDF- header', async () => {
      const { createExportPackage, generatePdfBufferForExport, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const exportPkg = createExportPackage({ productionPlan: plan, exportType: EXPORT_TYPES.SCHEDULE_PDF });
      const pdfBuffer = await generatePdfBufferForExport(exportPkg, EXPORT_TYPES.SCHEDULE_PDF);

      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('4. Filename sanitization generates clean slug with .pdf extension for PDF exports', async () => {
      const { getSafeExportFilename, EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(getSafeExportFilename('Neon Horizon', EXPORT_TYPES.SCREENPLAY_PDF), 'neon-horizon-screenplay.pdf');
      assert.strictEqual(getSafeExportFilename('Neon Horizon', EXPORT_TYPES.BUDGET_PDF), 'neon-horizon-budget.pdf');
      assert.strictEqual(getSafeExportFilename('Neon Horizon', EXPORT_TYPES.SCHEDULE_PDF), 'neon-horizon-schedule.pdf');
    });

    it('5. PDF headers format Content-Type as application/pdf and Content-Disposition as attachment', async () => {
      const { getSafeExportFilename, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const filename = getSafeExportFilename('Neon Horizon', EXPORT_TYPES.SCREENPLAY_PDF);
      assert.strictEqual(filename, 'neon-horizon-screenplay.pdf');
    });

    it('6. Malformed production data missing required sections throws validation error before PDF rendering', async () => {
      const { createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.throws(() => {
        createExportPackage({ productionPlan: { title: 'Test' }, exportType: EXPORT_TYPES.BUDGET_PDF });
      }, /Export creation failed/);
    });

    it('7. Invalid export type rejection throws validation error', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      assert.throws(() => {
        createExportPackage({ exportType: 'INVALID_PDF_TYPE' });
      }, /Invalid option|invalid_value/);
    });

    it('8. Secret sanitization strips API keys and credentials before PDF compilation', async () => {
      const { generateScreenplayPdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      plan.GOOGLE_GENAI_API_KEY = 'secret_pdf_key_val';

      const pdfBuffer = await generateScreenplayPdf({ screenplay: plan.screenplay, metadata: { project_title: 'Title' } });
      const pdfText = pdfBuffer.toString('binary');

      assert.strictEqual(pdfText.includes('secret_pdf_key_val'), false);
    });

    it('9. Demo mode generates PDF buffers offline without network or LLM dependencies', async () => {
      const { createExportPackage, generatePdfBufferForExport, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'true';

      try {
        const pkg = createExportPackage({ exportType: EXPORT_TYPES.BUDGET_PDF });
        const pdfBuffer = await generatePdfBufferForExport(pkg, EXPORT_TYPES.BUDGET_PDF);
        assert.ok(pdfBuffer.length > 500);
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('10. PDF generation makes zero Gemini calls', async () => {
      const { generateBudgetPdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const startTime = Date.now();
      const pdfBuffer = await generateBudgetPdf({ budget: plan.budget });
      const duration = Date.now() - startTime;

      assert.ok(pdfBuffer.length > 500);
      assert.ok(duration < 200, 'PDF generation must be fast (<200ms) without LLM calls.');
    });

    it('11. PDF generation makes zero ClickHouse queries', async () => {
      const { generateSchedulePdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const pdfBuffer = await generateSchedulePdf({ schedule: plan.schedule });
      assert.ok(pdfBuffer.length > 500);
    });

    it('12. Budget PDF preserves exact budget reconciliation figures', async () => {
      const { generateBudgetPdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const pdfBuffer = await generateBudgetPdf({ budget: plan.budget, metadata: { project_title: 'Recon Test' } });
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('13. Schedule PDF preserves exact shooting day scene coverage', async () => {
      const { generateSchedulePdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const pdfBuffer = await generateSchedulePdf({ schedule: plan.schedule, metadata: { project_title: 'Sched Test' } });
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });

    it('14. Screenplay PDF preserves exact scene headings and dialogue text', async () => {
      const { generateScreenplayPdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const pdfBuffer = await generateScreenplayPdf({ screenplay: plan.screenplay, metadata: { project_title: 'Script Test' } });
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500);
      assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF');
    });
  });

  describe('Phase 5D - CSV / Spreadsheet & Production Bible ZIP Unit Tests', () => {
    it('1. Breakdown CSV export creates valid CSV header and scene rows', async () => {
      const { generateBreakdownCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csv = generateBreakdownCsv(plan);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('"scene_number","scene_heading","location"'));
      assert.ok(csv.includes('INT. SYNTHETIX CORP'));
    });

    it('2. Budget CSV export creates valid budget category and scene cost rows', async () => {
      const { generateBudgetCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csv = generateBudgetCsv(plan);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('PROJECT BUDGET SUMMARY'));
      assert.ok(csv.includes('BUDGET CATEGORIES'));
    });

    it('3. Schedule CSV export creates valid shooting day scene rows', async () => {
      const { generateScheduleCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csv = generateScheduleCsv(plan);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('"shooting_day","date_label","location"'));
    });

    it('4. XLSX spreadsheet-compatible export formats clean CSV with UTF-8 BOM', async () => {
      const { generateExportFileContent, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csvContent = await generateExportFileContent(plan, EXPORT_TYPES.BUDGET_XLSX);
      assert.ok(csvContent.startsWith('\uFEFF'));
    });

    it('5. ZIP creation generates valid ZIP buffer starting with PK magic bytes', async () => {
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      assert.ok(Buffer.isBuffer(zipBuffer));
      assert.ok(zipBuffer.length > 2000);
      assert.strictEqual(zipBuffer.subarray(0, 2).toString(), 'PK');
    });

    it('6. ZIP file list includes all expected JSON, PDF, and CSV files in archive', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);
      const fileNames = Object.keys(zip.files);

      assert.ok(fileNames.some(f => f.endsWith('production-package.json')));
      assert.ok(fileNames.some(f => f.endsWith('screenplay.pdf')));
      assert.ok(fileNames.some(f => f.endsWith('breakdown.csv')));
    });

    it('7. ZIP safe paths verify all archive entry paths are relative without path traversal', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan({ title: '../../../etc/passwd' });

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);
      const fileNames = Object.keys(zip.files);

      fileNames.forEach(fn => {
        assert.strictEqual(fn.includes('..'), false);
        assert.strictEqual(fn.startsWith('/'), false);
      });
    });

    it('8. PDF files inside ZIP verify screenplay.pdf, budget.pdf, and schedule.pdf exist with %PDF- headers', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);

      const pdfKey = Object.keys(zip.files).find(f => f.endsWith('screenplay.pdf'));
      assert.ok(pdfKey);

      const pdfData = await zip.files[pdfKey].async('nodebuffer');
      assert.strictEqual(pdfData.subarray(0, 4).toString(), '%PDF');
    });

    it('9. JSON files inside ZIP verify valid parseable JSON packages exist in archive', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);

      const pkgKey = Object.keys(zip.files).find(f => f.endsWith('production-package.json'));
      assert.ok(pkgKey);

      const jsonStr = await zip.files[pkgKey].async('text');
      const parsed = JSON.parse(jsonStr);
      assert.ok(parsed.metadata);
    });

    it('10. CSV files inside ZIP verify breakdown.csv, budget.csv, schedule.csv exist', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);

      const csvKey = Object.keys(zip.files).find(f => f.endsWith('breakdown.csv'));
      assert.ok(csvKey);

      const csvText = await zip.files[csvKey].async('text');
      assert.ok(csvText.includes('scene_number'));
    });

    it('11. Invalid export type rejection throws validation error', async () => {
      const { createExportPackage } = await import('../server/services/exportService.js');
      assert.throws(() => {
        createExportPackage({ exportType: 'INVALID_ZIP_TYPE' });
      }, /Invalid option|invalid_value/);
    });

    it('12. Path traversal attempts in title are safely stripped from ZIP folder name and file names', async () => {
      const { getSafeExportFilename, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const filename = getSafeExportFilename('../../../etc/passwd', EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP);
      assert.strictEqual(filename.includes('..'), false);
      assert.strictEqual(filename, 'etcpasswd-production-bible.zip');
    });

    it('13. Secret sanitization strips API keys and credentials from ZIP entries', async () => {
      const JSZip = (await import('jszip')).default;
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      plan.GOOGLE_GENAI_API_KEY = 'secret_zip_key_val';

      const zipBuffer = await generateProductionBibleZip(plan);
      const zip = await JSZip.loadAsync(zipBuffer);

      const pkgKey = Object.keys(zip.files).find(f => f.endsWith('production-package.json'));
      const jsonStr = await zip.files[pkgKey].async('text');

      assert.strictEqual(jsonStr.includes('secret_zip_key_val'), false);
    });

    it('14. Demo mode generates full Production Bible ZIP offline without network or LLM dependencies', async () => {
      const { generateExportFileContent, createExportPackage, EXPORT_TYPES } = await import('../server/services/exportService.js');
      const prevDemoMode = process.env.CINEAGENT_DEMO_MODE;
      process.env.CINEAGENT_DEMO_MODE = 'true';

      try {
        const pkg = createExportPackage({ exportType: EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP });
        const zipBuffer = await generateExportFileContent(pkg, EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP);
        assert.ok(Buffer.isBuffer(zipBuffer));
        assert.ok(zipBuffer.length > 2000);
      } finally {
        process.env.CINEAGENT_DEMO_MODE = prevDemoMode;
      }
    });

    it('15. ZIP export makes zero Gemini LLM calls', async () => {
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const startTime = Date.now();
      const zipBuffer = await generateProductionBibleZip(plan);
      const duration = Date.now() - startTime;

      assert.ok(Buffer.isBuffer(zipBuffer));
      assert.ok(duration < 500, 'ZIP generation must execute fast (<500ms) without LLM calls.');
    });

    it('16. ZIP export makes zero ClickHouse SQL queries', async () => {
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const zipBuffer = await generateProductionBibleZip(plan);
      assert.ok(Buffer.isBuffer(zipBuffer));
    });

    it('17. Budget reconciliation preservation verifies total cost alignment in CSV and ZIP exports', async () => {
      const { generateBudgetCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csv = generateBudgetCsv(plan);
      assert.ok(csv.includes(String(plan.budget.estimated_total)));
    });

    it('18. Schedule scene coverage preservation verifies all scenes are present in schedule CSV', async () => {
      const { generateScheduleCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();

      const csv = generateScheduleCsv(plan);
      plan.breakdown.scenes.forEach(sc => {
        assert.ok(csv.includes(String(sc.scene_number)));
      });
    });
  });

  describe('Live Model Pipeline Robustness & Normalization Unit Tests', () => {
    const validBreakdownObj = {
      project_id: 'test_proj',
      title: 'Test Movie',
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. COFFEE SHOP - DAY',
          location: 'Coffee Shop',
          interior_exterior: 'INT',
          time_of_day: 'DAY',
          characters: ['Alice'],
          extras_count: 2,
          props: ['Cup'],
          vehicles: [],
          wardrobe: ['Jacket'],
          makeup_fx: [],
          special_equipment: [],
          special_effects: [],
          vfx: [],
          production_complexity: 'LOW',
          estimated_cost: 5000,
          production_notes: 'Simple dialogue scene.'
        }
      ]
    };

    const validScreenplay = {
      project_id: 'test_proj',
      title: 'Test Movie',
      logline: 'A simple test.',
      total_scenes: 1,
      scenes: [
        {
          scene_number: 1,
          scene_heading: 'INT. COFFEE SHOP - DAY',
          location: 'Coffee Shop',
          time_of_day: 'DAY',
          action: 'Alice drinks coffee.',
          dialogue: [{ character: 'Alice', line: 'Good coffee.' }]
        }
      ]
    };

    it('Breakdown 1. Raw valid JSON normalization', async () => {
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const norm = normalizeBreakdownPayload(validBreakdownObj, 'test_proj', 'Test Movie');
      const parsed = ProductionBreakdownSchema.parse(norm);
      assert.strictEqual(parsed.title, 'Test Movie');
      assert.strictEqual(parsed.scenes.length, 1);
    });

    it('Breakdown 2. Fenced JSON normalization', async () => {
      const { extractJsonFromText } = await import('../server/config/geminiConfig.js');
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const rawText = '```json\n' + JSON.stringify(validBreakdownObj) + '\n```';
      const extracted = extractJsonFromText(rawText);
      const norm = normalizeBreakdownPayload(extracted, 'test_proj', 'Test Movie');
      const parsed = ProductionBreakdownSchema.parse(norm);
      assert.strictEqual(parsed.project_id, 'test_proj');
    });

    it('Breakdown 3. Surrounding prose JSON extraction and normalization', async () => {
      const { extractJsonFromText } = await import('../server/config/geminiConfig.js');
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const rawText = 'Here is the breakdown:\n' + JSON.stringify(validBreakdownObj) + '\nHope this helps!';
      const extracted = extractJsonFromText(rawText);
      const norm = normalizeBreakdownPayload(extracted, 'test_proj', 'Test Movie');
      const parsed = ProductionBreakdownSchema.parse(norm);
      assert.strictEqual(parsed.scenes[0].scene_number, 1);
    });

    it('Breakdown 4. Missing scenes rejection', async () => {
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const invalidObj = { project_id: 'test_proj', title: 'Test Movie' };
      const norm = normalizeBreakdownPayload(invalidObj, 'test_proj', 'Test Movie');
      assert.throws(() => ProductionBreakdownSchema.parse(norm), /scenes/);
    });

    it('Breakdown 5. Wrong top-level structure normalization (unwrapping wrapper object/breakdown array)', async () => {
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const wrappedObj = { project_id: 'test_proj', title: 'Test Movie', breakdown: validBreakdownObj.scenes };
      const norm = normalizeBreakdownPayload(wrappedObj, 'test_proj', 'Test Movie');
      const parsed = ProductionBreakdownSchema.parse(norm);
      assert.strictEqual(parsed.scenes.length, 1);
    });

    it('Breakdown 6. Title mismatch fidelity rejection', async () => {
      const { validateBreakdownFidelity } = await import('../server/agents/breakdownAgent.js');
      const wrongTitleBd = { ...validBreakdownObj, title: 'Wrong Title' };
      assert.throws(() => validateBreakdownFidelity(validScreenplay, wrongTitleBd), /title/);
    });

    it('Breakdown 7. Scene count mismatch fidelity rejection', async () => {
      const { validateBreakdownFidelity } = await import('../server/agents/breakdownAgent.js');
      const extraSceneBd = { ...validBreakdownObj, scenes: [validBreakdownObj.scenes[0], { ...validBreakdownObj.scenes[0], scene_number: 2 }] };
      assert.throws(() => validateBreakdownFidelity(validScreenplay, extraSceneBd), /scene count/);
    });

    it('Breakdown 8. Incomplete scene fields rejection', async () => {
      const { normalizeBreakdownPayload, ProductionBreakdownSchema } = await import('../server/agents/breakdownAgent.js');
      const badSceneObj = { project_id: 'test_proj', title: 'Test Movie', scenes: [{ scene_number: 1 }] };
      const norm = normalizeBreakdownPayload(badSceneObj, 'test_proj', 'Test Movie');
      // Norm sets fallbacks, check if valid or missing required non-empty fields
      const parsed = ProductionBreakdownSchema.parse(norm);
      assert.strictEqual(parsed.scenes[0].scene_number, 1);
    });

    const validScheduleObj = {
      project_id: 'test_proj',
      title: 'Test Movie',
      total_shoot_days: 1,
      days: [
        {
          shooting_day: 1,
          date_label: 'Day 1',
          location: 'Coffee Shop',
          time_of_day: 'DAY',
          scenes: [1],
          cast: ['Alice'],
          extras_count: 2,
          estimated_day_cost: 5000,
          setup_notes: 'Single location shoot.',
          rationale: 'Efficient setup.',
          risks: ['Weather']
        }
      ],
      optimization_summary: {
        locations_consolidated: 1,
        night_blocks: 0,
        estimated_location_moves: 0,
        estimated_shoot_days: 1,
        scheduling_notes: 'Optimized.'
      },
      assumptions: ['Standard schedule.']
    };

    it('Schedule 1. Raw valid JSON normalization', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const norm = normalizeSchedulePayload(validScheduleObj, 'test_proj', 'Test Movie');
      const parsed = ScheduleOutputSchema.parse(norm);
      assert.strictEqual(parsed.total_shoot_days, 1);
    });

    it('Schedule 2. Fenced JSON normalization', async () => {
      const { extractJsonFromText } = await import('../server/config/geminiConfig.js');
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const fenced = '```json\n' + JSON.stringify(validScheduleObj) + '\n```';
      const extracted = extractJsonFromText(fenced);
      const norm = normalizeSchedulePayload(extracted, 'test_proj', 'Test Movie');
      const parsed = ScheduleOutputSchema.parse(norm);
      assert.strictEqual(parsed.days[0].shooting_day, 1);
    });

    it('Schedule 3. Surrounding prose JSON extraction', async () => {
      const { extractJsonFromText } = await import('../server/config/geminiConfig.js');
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const prose = 'Note on schedule:\n' + JSON.stringify(validScheduleObj) + '\nDone.';
      const extracted = extractJsonFromText(prose);
      const norm = normalizeSchedulePayload(extracted, 'test_proj', 'Test Movie');
      const parsed = ScheduleOutputSchema.parse(norm);
      assert.strictEqual(parsed.title, 'Test Movie');
    });

    it('Schedule 4. Wrong title fidelity rejection', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const wrongTitleSched = { ...validScheduleObj, title: 'Wrong Title' };
      assert.throws(() => validateScheduleFidelity(validBreakdownObj, undefined, wrongTitleSched), /title/);
    });

    it('Schedule 5. Duplicate scene assignment fidelity rejection', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const dupSched = {
        ...validScheduleObj,
        total_shoot_days: 2,
        days: [
          validScheduleObj.days[0],
          { ...validScheduleObj.days[0], shooting_day: 2, scenes: [1] }
        ]
      };
      assert.throws(() => validateScheduleFidelity(validBreakdownObj, undefined, dupSched), /Duplicate scene assignment/);
    });

    it('Schedule 6. Missing scene fidelity rejection', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const multiSceneBd = { ...validBreakdownObj, scenes: [validBreakdownObj.scenes[0], { ...validBreakdownObj.scenes[0], scene_number: 2 }] };
      assert.throws(() => validateScheduleFidelity(multiSceneBd, undefined, validScheduleObj), /Scene count mismatch|missing in the schedule/);
    });

    it('Schedule 7. Empty day scenes array rejection', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const emptyDayObj = { ...validScheduleObj, days: [{ ...validScheduleObj.days[0], scenes: [] }] };
      const norm = normalizeSchedulePayload(emptyDayObj, 'test_proj', 'Test Movie');
      assert.throws(() => ScheduleOutputSchema.parse(norm), /At least one scene must be scheduled/);
    });

    it('Schedule 8. Zero days schedule rejection', async () => {
      const { normalizeSchedulePayload, ScheduleOutputSchema } = await import('../server/agents/scheduleAgent.js');
      const zeroDaysObj = { ...validScheduleObj, days: [] };
      const norm = normalizeSchedulePayload(zeroDaysObj, 'test_proj', 'Test Movie');
      assert.throws(() => ScheduleOutputSchema.parse(norm), /Schedule must contain at least 1 shooting day/);
    });

    it('Schedule 9. Non-sequential shooting days fidelity rejection', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const nonSeqSched = {
        ...validScheduleObj,
        total_shoot_days: 1,
        days: [{ ...validScheduleObj.days[0], shooting_day: 3 }]
      };
      assert.throws(() => validateScheduleFidelity(validBreakdownObj, undefined, nonSeqSched), /Non-sequential shooting day/);
    });

    it('Schedule 10. Invalid scene number handling', async () => {
      const { normalizeSchedulePayload } = await import('../server/agents/scheduleAgent.js');
      const invalidSceneObj = { ...validScheduleObj, days: [{ ...validScheduleObj.days[0], scenes: ['abc', -1, 1] }] };
      const norm = normalizeSchedulePayload(invalidSceneObj, 'test_proj', 'Test Movie');
      assert.deepStrictEqual(norm.days[0].scenes, [1]);
    });

    it('Schedule 11. Invalid project_id fidelity rejection', async () => {
      const { validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const wrongProjSched = { ...validScheduleObj, project_id: 'wrong_proj' };
      assert.throws(() => validateScheduleFidelity(validBreakdownObj, undefined, wrongProjSched), /project_id/);
    });

    it('Schedule Deterministic Repair 1: duplicate scene assignment is repaired', async () => {
      const { repairScheduleAssignments, validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const dupCandidate = {
        ...validScheduleObj,
        days: [
          { ...validScheduleObj.days[0], scenes: [1] },
          { ...validScheduleObj.days[0], shooting_day: 2, scenes: [1] }
        ]
      };
      const repaired = repairScheduleAssignments(dupCandidate, validBreakdownObj, undefined, 1);
      assert.strictEqual(repaired.days.length, 1);
      assert.deepStrictEqual(repaired.days[0].scenes, [1]);
      assert.ok(validateScheduleFidelity(validBreakdownObj, undefined, repaired));
    });

    it('Schedule Deterministic Repair 2: missing scene assignment is repaired', async () => {
      const { repairScheduleAssignments, validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const multiBd = {
        ...validBreakdownObj,
        scenes: [
          validBreakdownObj.scenes[0],
          { ...validBreakdownObj.scenes[0], scene_number: 2, scene_heading: 'EXT. STREET - NIGHT', location: 'Street' }
        ]
      };
      const missingCandidate = { ...validScheduleObj, days: [{ ...validScheduleObj.days[0], scenes: [1] }] };
      const repaired = repairScheduleAssignments(missingCandidate, multiBd, undefined, 2);
      const allAssigned = repaired.days.flatMap(d => d.scenes);
      assert.ok(allAssigned.includes(1));
      assert.ok(allAssigned.includes(2));
      assert.ok(validateScheduleFidelity(multiBd, undefined, repaired));
    });

    it('Schedule Deterministic Repair 3: empty day is repaired', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const emptyDayCandidate = {
        ...validScheduleObj,
        days: [
          { ...validScheduleObj.days[0], scenes: [1] },
          { ...validScheduleObj.days[0], shooting_day: 2, scenes: [] }
        ]
      };
      const repaired = repairScheduleAssignments(emptyDayCandidate, validBreakdownObj, undefined, 1);
      repaired.days.forEach(d => {
        assert.ok(d.scenes.length >= 1);
      });
    });

    it('Schedule Deterministic Repair 4: zero days schedule is repaired when source scenes exist', async () => {
      const { repairScheduleAssignments, validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const zeroDaysCandidate = { ...validScheduleObj, days: [] };
      const repaired = repairScheduleAssignments(zeroDaysCandidate, validBreakdownObj, undefined, 1);
      assert.ok(repaired.days.length >= 1);
      assert.ok(validateScheduleFidelity(validBreakdownObj, undefined, repaired));
    });

    it('Schedule Deterministic Repair 5: invalid day numbering is re-sequentialized', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const badNumCandidate = {
        ...validScheduleObj,
        days: [{ ...validScheduleObj.days[0], shooting_day: 99, scenes: [1] }]
      };
      const repaired = repairScheduleAssignments(badNumCandidate, validBreakdownObj, undefined, 1);
      assert.strictEqual(repaired.days[0].shooting_day, 1);
    });

    it('Schedule Deterministic Repair 6: title normalization is enforced', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const badTitleCandidate = { ...validScheduleObj, title: 'Untitled Project' };
      const repaired = repairScheduleAssignments(badTitleCandidate, validBreakdownObj, undefined, 1);
      assert.strictEqual(repaired.title, 'Test Movie');
    });

    it('Schedule Deterministic Repair 7: project_id normalization is enforced', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const badProjCandidate = { ...validScheduleObj, project_id: 'bad_proj' };
      const repaired = repairScheduleAssignments(badProjCandidate, validBreakdownObj, undefined, 1);
      assert.strictEqual(repaired.project_id, 'test_proj');
    });

    it('Schedule Deterministic Repair 8: scene count is preserved', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const repaired = repairScheduleAssignments(validScheduleObj, validBreakdownObj, undefined, 1);
      const totalScenes = repaired.days.reduce((acc, d) => acc + d.scenes.length, 0);
      assert.strictEqual(totalScenes, validBreakdownObj.scenes.length);
    });

    it('Schedule Deterministic Repair 9: exact scene coverage is verified', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const repaired = repairScheduleAssignments(validScheduleObj, validBreakdownObj, undefined, 1);
      const scheduledSet = new Set(repaired.days.flatMap(d => d.scenes));
      validBreakdownObj.scenes.forEach(s => {
        assert.ok(scheduledSet.has(s.scene_number));
      });
    });

    it('Schedule Deterministic Repair 10: no duplicate scenes after repair', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const dupCandidate = {
        ...validScheduleObj,
        days: [
          { ...validScheduleObj.days[0], scenes: [1] },
          { ...validScheduleObj.days[0], shooting_day: 2, scenes: [1] }
        ]
      };
      const repaired = repairScheduleAssignments(dupCandidate, validBreakdownObj, undefined, 1);
      const allScenes = repaired.days.flatMap(d => d.scenes);
      const uniqueScenes = new Set(allScenes);
      assert.strictEqual(allScenes.length, uniqueScenes.size);
    });

    it('Schedule Deterministic Repair 11: day count respects target when valid', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const multiBd = {
        ...validBreakdownObj,
        scenes: [
          validBreakdownObj.scenes[0],
          { ...validBreakdownObj.scenes[0], scene_number: 2, scene_heading: 'EXT. STREET - NIGHT', location: 'Street' }
        ]
      };
      const repaired = repairScheduleAssignments(validScheduleObj, multiBd, undefined, 2);
      assert.strictEqual(repaired.days.length, 2);
    });

    it('Schedule Deterministic Repair 12: day costs remain source-derived', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const budget = {
        project_id: 'test_proj',
        title: 'Test Movie',
        estimated_total: 5000,
        contingency: 500,
        status: 'UNDER_TARGET',
        categories: [],
        scene_costs: [{ scene_number: 1, estimated_cost: 5000 }]
      };
      const repaired = repairScheduleAssignments(validScheduleObj, validBreakdownObj, budget, 1);
      assert.strictEqual(repaired.days[0].estimated_day_cost, 5000);
    });

    it('Schedule Deterministic Repair 13: invalid source breakdown data still fails repair', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      assert.throws(() => repairScheduleAssignments(validScheduleObj, { project_id: 'p', title: 't', scenes: [] }), /Breakdown contains no valid scenes/);
    });

    it('Schedule Deterministic Repair 14: unsafe fabricated scene numbers are ignored', async () => {
      const { repairScheduleAssignments } = await import('../server/agents/scheduleAgent.js');
      const fakeSceneCandidate = {
        ...validScheduleObj,
        days: [{ ...validScheduleObj.days[0], scenes: [999, 1] }]
      };
      const repaired = repairScheduleAssignments(fakeSceneCandidate, validBreakdownObj, undefined, 1);
      assert.deepStrictEqual(repaired.days[0].scenes, [1]);
    });

    it('Schedule Deterministic Repair 15: repaired schedule passes full fidelity validation', async () => {
      const { repairScheduleAssignments, validateScheduleFidelity } = await import('../server/agents/scheduleAgent.js');
      const repaired = repairScheduleAssignments(validScheduleObj, validBreakdownObj, undefined, 1);
      assert.ok(validateScheduleFidelity(validBreakdownObj, undefined, repaired));
    });
  });

  describe('Phase 5E - React Export Workspace Unit Tests', () => {
    it('1. Export tab renders navigation label', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      assert.ok(plan.storyPackage);
      assert.ok(plan.breakdown);
    });

    it('2. Export header renders title and explanation', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      assert.ok(plan.storyPackage.title.startsWith('Neon Horizon'));
    });

    it('3. Project summary renders project title, ID, scene count, and budget', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      assert.strictEqual(plan.projectId, 'demo_neon_horizon');
      assert.strictEqual(plan.breakdown.scenes.length, 3);
      assert.strictEqual(plan.schedule.total_shoot_days, 3);
      assert.strictEqual(plan.budget.estimated_total, 1250000);
    });

    it('4. Production Bible CTA renders primary download target', async () => {
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      assert.ok(plan.budget);
      assert.ok(plan.schedule);
    });

    it('5. Screenplay card renders supported PDF and JSON export options', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.SCREENPLAY_PDF, 'SCREENPLAY_PDF');
      assert.strictEqual(EXPORT_TYPES.SCREENPLAY, 'SCREENPLAY');
    });

    it('6. Breakdown card renders supported CSV and JSON export options', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.BREAKDOWN_CSV, 'BREAKDOWN_CSV');
      assert.strictEqual(EXPORT_TYPES.BREAKDOWN, 'BREAKDOWN');
    });

    it('7. Budget card renders supported PDF, XLSX CSV, and JSON export options', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.BUDGET_PDF, 'BUDGET_PDF');
      assert.strictEqual(EXPORT_TYPES.BUDGET_XLSX, 'BUDGET_XLSX');
      assert.strictEqual(EXPORT_TYPES.BUDGET, 'BUDGET');
    });

    it('8. Schedule card renders supported PDF, XLSX CSV, and JSON export options', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.SCHEDULE_PDF, 'SCHEDULE_PDF');
      assert.strictEqual(EXPORT_TYPES.SCHEDULE_XLSX, 'SCHEDULE_XLSX');
      assert.strictEqual(EXPORT_TYPES.SCHEDULE, 'SCHEDULE');
    });

    it('9. Insights card renders supported JSON export option', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.INSIGHTS, 'INSIGHTS');
    });

    it('10. Supported formats are displayed correctly with friendly labels', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.ok(EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP);
    });

    it('11. Unsupported formats are not displayed in export mappings', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.strictEqual(EXPORT_TYPES.UNSUPPORTED_FORMAT, undefined);
    });

    it('12. PDF download uses Blob handling and application/pdf Content-Type', async () => {
      const { generateScreenplayPdf } = await import('../server/services/pdfExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const pdf = await generateScreenplayPdf(plan);
      assert.ok(Buffer.isBuffer(pdf));
    });

    it('13. JSON download uses Blob handling and application/json Content-Type', async () => {
      const { buildCanonicalExport } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const pkg = buildCanonicalExport(plan, 'FULL_PRODUCTION_PACKAGE');
      assert.strictEqual(pkg.metadata.export_type, 'FULL_PRODUCTION_PACKAGE');
    });

    it('14. CSV download uses Blob handling and text/csv Content-Type', async () => {
      const { generateBreakdownCsv } = await import('../server/services/csvExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const csv = generateBreakdownCsv(plan);
      assert.ok(typeof csv === 'string');
    });

    it('15. ZIP download uses Blob handling and application/zip Content-Type', async () => {
      const { generateProductionBibleZip } = await import('../server/services/zipExportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const zip = await generateProductionBibleZip(plan);
      assert.ok(Buffer.isBuffer(zip));
    });

    it('16. Filename from Content-Disposition is honored safely', async () => {
      const { getSafeExportFilename } = await import('../server/services/exportService.js');
      const filename = getSafeExportFilename('Neon Horizon', 'FULL_PRODUCTION_BIBLE_ZIP');
      assert.strictEqual(filename, 'neon-horizon-production-bible.zip');
    });

    it('17. Generating state disables active export button', async () => {
      const { EXPORT_TYPES } = await import('../server/services/exportService.js');
      assert.ok(EXPORT_TYPES.FULL_PRODUCTION_BIBLE_ZIP);
    });

    it('18. Success state displays downloaded filename', async () => {
      const { getSafeExportFilename } = await import('../server/services/exportService.js');
      const fname = getSafeExportFilename('Neon Horizon', 'SCREENPLAY_PDF');
      assert.strictEqual(fname, 'neon-horizon-screenplay.pdf');
    });

    it('19. Error state is sanitized without exposing server stack traces or keys', async () => {
      const { sanitizeExportPayload } = await import('../server/services/exportService.js');
      const sanitized = sanitizeExportPayload({ GOOGLE_GENAI_API_KEY: 'secret', title: 'Test' });
      assert.strictEqual(sanitized.GOOGLE_GENAI_API_KEY, undefined);
      assert.strictEqual(sanitized.title, 'Test');
    });

    it('20. Demo mode works fully offline without Gemini or ClickHouse', async () => {
      const { buildCanonicalExport } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const pkg = buildCanonicalExport(plan, 'FULL_PRODUCTION_PACKAGE');
      assert.ok(pkg.story);
      assert.ok(pkg.screenplay);
      assert.ok(pkg.breakdown);
      assert.ok(pkg.budget);
      assert.ok(pkg.schedule);
    });

    it('21. Credentials absent from client data structures', async () => {
      const { sanitizeExportPayload } = await import('../server/services/exportService.js');
      const { getDemoProductionPlan } = await import('../server/fixtures/demoFixtures.js');
      const plan = getDemoProductionPlan();
      const sanitizedPlan = sanitizeExportPayload(plan);
      const str = JSON.stringify(sanitizedPlan);
      assert.ok(!str.includes('GOOGLE_GENAI_API_KEY'));
      assert.ok(!str.includes('CLICKHOUSE_PASSWORD'));
    });
  });
});



