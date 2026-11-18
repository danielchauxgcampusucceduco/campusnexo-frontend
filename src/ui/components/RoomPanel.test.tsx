import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // The stage router reads the URL hash when it loads; the server renderer has no window.
  Object.assign(globalThis, { location: { hash: '' }, addEventListener: () => {}, removeEventListener: () => {} });
});
import { renderToStaticMarkup } from 'react-dom/server';
import { twinSpace } from '../../test/fixtures';
import { CONDITION_META } from '../theme';
import { RoomPanel } from './RoomPanel';

describe('room panel', () => {
  it('says a room with more people than seats is over capacity', () => {
    const markup = renderToStaticMarkup(<RoomPanel twin={twinSpace({ occupancy: 34 })} />);

    expect(markup).toContain(CONDITION_META.SOBRECUPO.label);
    expect(markup).toContain('de 30 personas');
  });

  it('warns when the camera lost its signal', () => {
    const markup = renderToStaticMarkup(<RoomPanel twin={twinSpace({ cameraOnline: false, occupancy: 4 })} />);

    expect(markup).toContain('Cámara sin señal');
  });

  it('does not follow an office, which students do not use', () => {
    const markup = renderToStaticMarkup(<RoomPanel twin={twinSpace({}, { type: 'ADMINISTRATIVA', accesibleParaEstudiantes: false })} />);

    expect(markup).toContain('no se monitorea');
    expect(markup).not.toContain('de 30 personas');
  });

  it('shows who the camera places in front of the board and in the seats, and that the data is emulated', () => {
    const markup = renderToStaticMarkup(<RoomPanel twin={twinSpace({ teachersPresent: 1, studentsPresent: 24, occupancy: 25 })} />);

    expect(markup).toContain('1 en la zona del docente');
    expect(markup).toContain('24 en los puestos');
    expect(markup).toContain('Emulado');
  });
});
