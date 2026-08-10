import assert from 'assert';
import dotenv from 'dotenv';
import { StoryOutputSchema } from '../server/agents/storyAgent.js';

dotenv.config();

describe('CineAgent Studio - Phase 1 Unit Tests', () => {
  it('should validate local environment structure checks', () => {
    // Assert structure variables are present
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
});
