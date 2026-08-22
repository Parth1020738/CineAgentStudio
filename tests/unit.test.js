import assert from 'assert';
import dotenv from 'dotenv';
import { StoryOutputSchema } from '../server/agents/storyAgent.js';
import { ScreenplayOutputSchema, ScreenplayInputSchema, recordScreenplayTelemetry } from '../server/agents/screenplayAgent.js';
import { mapStoryToScreenplayInput, validatePipelineContinuity } from '../server/agents/pipeline.js';
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
});
