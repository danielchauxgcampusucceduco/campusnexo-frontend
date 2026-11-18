import { describe, expect, it } from 'vitest';
import type { Alert } from '../../domain/model';
import { groupAlerts } from './AlertsView';

const alert = (alertId: string, spaceId: string, at: string, type: Alert['type'] = 'FALLO_CAMARA', severity: Alert['severity'] = 'ADVERTENCIA') =>
  ({ alertId, spaceId, type, severity, detectedAt: at, message: 'La cámara no envía frames' }) as Alert;

describe('alert groups', () => {
  it('joins the same event in several rooms and keeps other events apart', () => {
    const groups = groupAlerts([
      alert('1', '308-A', '2026-11-01T12:00:30Z'),
      alert('2', '309-A', '2026-11-01T12:00:30Z'),
      alert('3', '310-A', '2026-11-01T12:00:01Z'),
      alert('4', '310-A', '2026-11-01T12:00:00Z', 'SOBRECUPO'),
      alert('5', '301-A', '2026-11-01T11:50:00Z'),
    ]);

    expect(groups.map((g) => g.alerts.map((a) => a.alertId))).toEqual([['1', '2', '3'], ['4'], ['5']]);
  });
});
