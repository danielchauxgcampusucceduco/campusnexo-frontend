import { describe, expect, it } from 'vitest';
import { summarizeOutcome } from './outcome';

describe('scenario outcome summary', () => {
  it('provides a complete reset summary when there is no affected room', () => {
    const outcome = summarizeOutcome('REINICIAR', undefined, null, undefined, null);

    expect(outcome.spaceId).toBe('*');
    expect(outcome.spaceName).toBe('Todo el campus');
    expect(outcome.cause).toBe('Se reinicia la demostración');
    expect(outcome.effect).toBe('Listo para el siguiente escenario');
    expect(outcome.traceId).toBeNull();
  });

  it('keeps the trace identity when a reset event has an architecture trace', () => {
    const trace = { traceId: 'trace-123' } as never;
    const outcome = summarizeOutcome('REINICIAR', undefined, trace, undefined, null);

    expect(outcome.id).toBe('trace-123');
    expect(outcome.traceId).toBe('trace-123');
  });
});
