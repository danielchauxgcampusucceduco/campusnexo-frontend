import type { SpaceStatus } from '../../domain/model';
import { STATUS_META } from '../theme';

export function StatusBadge({ status, size = 'md' }: { status: SpaceStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-sm'}`}
      style={{ color: meta.ink, borderColor: `color-mix(in oklab, ${meta.color} 45%, transparent)`, background: `color-mix(in oklab, ${meta.color} 10%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
