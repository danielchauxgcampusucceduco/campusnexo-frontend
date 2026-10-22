import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HVAC_CONTROL_STATES, SPACE_STATUSES } from '../../domain/model';
import { HvacBadge, StatusBadge } from './StatusBadge';
import { HVAC_META, STATUS_META } from '../theme';

describe('state badges', () => {
  it('renders every room status with its human label and explanatory title', () => {
    for (const status of SPACE_STATUSES) {
      const markup = renderToStaticMarkup(<StatusBadge status={status} />);
      expect(markup).toContain(STATUS_META[status].label);
      expect(markup).toContain(`title="${STATUS_META[status].hint}"`);
    }
  });

  it('renders every HVAC state with the matching label and accessible hint', () => {
    for (const state of HVAC_CONTROL_STATES) {
      const markup = renderToStaticMarkup(<HvacBadge state={state} size="sm" />);
      expect(markup).toContain(HVAC_META[state].label);
      expect(markup).toContain(`title="${HVAC_META[state].hint}"`);
      expect(markup).toContain('text-xs');
    }
  });
});
