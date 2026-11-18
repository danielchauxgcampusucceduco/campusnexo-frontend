import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPACE_STATUSES } from '../../domain/model';
import { StatusBadge } from './StatusBadge';
import { STATUS_META } from '../theme';

describe('state badges', () => {
  it('renders every room status with its human label and explanatory title', () => {
    for (const status of SPACE_STATUSES) {
      const markup = renderToStaticMarkup(<StatusBadge status={status} />);
      expect(markup).toContain(STATUS_META[status].label);
      expect(markup).toContain(`title="${STATUS_META[status].hint}"`);
    }
  });
});
