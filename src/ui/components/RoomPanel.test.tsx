import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // The stage router reads the URL hash when it loads; the server renderer has no window.
  Object.assign(globalThis, { location: { hash: '' }, addEventListener: () => {}, removeEventListener: () => {} });
});
import { renderToStaticMarkup } from 'react-dom/server';
import { twinSpace } from '../../test/fixtures';
import { HVAC_META, HVAC_MODE_LABEL } from '../theme';
import { RoomPanel } from './RoomPanel';

describe('room panel', () => {
  it('explains what the climate unit is doing, towards which setpoint and why', () => {
    const twin = twinSpace({
      hvacState: 'OVERRIDE_MANUAL_DOCENTE', hvacMode: 'CALEFACCION', hvacSetpointC: 21.5,
      hvacReason: 'Control manual del docente hasta las 10:45',
    });
    const markup = renderToStaticMarkup(<RoomPanel twin={twin} />);

    expect(markup).toContain(HVAC_META.OVERRIDE_MANUAL_DOCENTE.label);
    expect(markup).toContain(HVAC_MODE_LABEL.CALEFACCION);
    expect(markup).toContain('21,5 °C');
    expect(markup).toContain('Control manual del docente');
  });

  it('says plainly that a room without a climate unit has nothing to control', () => {
    const twin = twinSpace({ hvacState: 'SIN_CLIMATIZACION' }, { hvacInstalled: false });
    const markup = renderToStaticMarkup(<RoomPanel twin={twin} />);

    expect(markup).toContain(HVAC_META.SIN_CLIMATIZACION.label);
    expect(markup).not.toContain(HVAC_MODE_LABEL.CALEFACCION);
  });

  it('shows who the camera places in front of the board and in the seats, and that the data is emulated', () => {
    const markup = renderToStaticMarkup(<RoomPanel twin={twinSpace({ teachersPresent: 1, studentsPresent: 24, occupancy: 25 })} />);

    expect(markup).toContain('1 en la zona del docente');
    expect(markup).toContain('24 en los puestos');
    expect(markup).toContain('Emulado');
  });
});
