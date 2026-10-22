import { describe, expect, it } from 'vitest';
import { BackendTwinGateway } from './BackendTwinGateway';
import type { GatewayUser, TwinGateway } from '../../ports/TwinGateway';

const user = (role: GatewayUser['role']): GatewayUser => ({
  username: 'campus-user',
  role,
  signedIn: true,
});

describe('BackendTwinGateway capabilities', () => {
  it.each([
    ['ADMIN', true, true],
    ['OPERATOR', false, true],
    ['VIEWER', false, false],
    ['SENSOR', false, false],
  ] as const)('maps the %s server role to the allowed UI capabilities', (role, scenarios, operations) => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', 'token', user(role));

    expect(gateway.capabilities.scenarios).toBe(scenarios);
    expect(gateway.capabilities.operations).toBe(operations);
    expect(gateway.capabilities.checkIn).toBe(false);
    expect(gateway.capabilities.lightControl).toBe(false);
    gateway.stop();
  });

  it('keeps real camera controls behind the edge worker', () => {
    const gateway: TwinGateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', 'token', user('ADMIN'));

    expect(() => gateway.setCameraOnline('AULA-301', false)).toThrow('la cámara se controla desde el edge');
    expect(() => gateway.setTimeScale(2)).toThrow('funciona en tiempo real');
  });
});
