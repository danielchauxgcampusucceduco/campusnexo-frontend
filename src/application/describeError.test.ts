import { describe, expect, it } from 'vitest';
import { BackendError } from '../adapters/backend/http';
import { describeError } from './TwinContext';

describe('describeError', () => {
  it('asks for the VPN when the backend says the request is outside the administration network', () => {
    expect(describeError(new BackendError(403, 'x', 'admin_network_required'))).toContain('VPN');
  });

  it('tells a missing role apart from the network', () => {
    expect(describeError(new BackendError(403, 'x', 'forbidden'))).toBe('Tu rol no permite esta acción.');
  });

  it('keeps the message of business rules', () => {
    expect(describeError(new BackendError(409, 'El estudiante no puede reservar un auditorio', 'reservation_not_allowed')))
      .toBe('El estudiante no puede reservar un auditorio');
  });
});
