import { describe, expect, it } from 'vitest';
import { pendingInputFromEvent } from './human-input';

describe('pendingInputFromEvent', () => {
  it('maps prompt field from harness events', () => {
    const input = pendingInputFromEvent({
      requestId: 'req-1',
      prompt: 'Which option do you prefer?',
      context: 'Draft A vs Draft B',
    }, 'dispatcher');
    expect(input.question).toBe('Which option do you prefer?');
    expect(input.context).toBe('Draft A vs Draft B');
    expect(input.agentRole).toBe('dispatcher');
  });
});
