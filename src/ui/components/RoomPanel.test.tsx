import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // The stage router reads the URL hash when it loads; the server renderer has no window.
  Object.assign(globalThis, { location: { hash: '' }, addEventListener: () => {}, removeEventListener: () => {} });
});
vi.mock('../../application/TwinContext', () => ({ useTwin: () => ({ gateway: { capabilities: {}, mode: 'simulation' } }) }));
import { renderToStaticMarkup } from 'react-dom/server';
import { InMemoryPhysicsGateway } from '../../adapters/simulation/InMemoryPhysicsGateway';
import { HVAC_META, HVAC_MODE_LABEL } from '../theme';
import { RoomPanel } from './RoomPanel';

const START = Date.parse('2026-10-20T15:00:00Z');

describe('room panel', () => {
  it('explains what the climate unit is doing, towards which setpoint and why', async () => {
    const gateway = new InMemoryPhysicsGateway(START);
    await gateway.runScenario('OVERRIDE_DOCENTE');
    const twin = gateway.getSnapshot().twins.find((t) => t.space.spaceId === '420-A')!;
    const markup = renderToStaticMarkup(<RoomPanel twin={twin} />);

    expect(markup).toContain(HVAC_META.OVERRIDE_MANUAL_DOCENTE.label);
    expect(markup).toContain(HVAC_MODE_LABEL[twin.state.hvacMode]);
    expect(markup).toContain('°C');
    expect(markup).toContain('Control manual del docente');
  });

  it('says plainly that a room without a climate unit has nothing to control', () => {
    const twin = new InMemoryPhysicsGateway(START).getSnapshot().twins.find((t) => !t.space.hvacInstalled)!;
    const markup = renderToStaticMarkup(<RoomPanel twin={twin} />);

    expect(markup).toContain(HVAC_META.SIN_CLIMATIZACION.label);
    expect(markup).not.toContain(HVAC_MODE_LABEL.CALEFACCION);
  });
});
