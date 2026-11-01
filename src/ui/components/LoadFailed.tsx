import { Lock, RefreshCw } from 'lucide-react';

/**
 * A section that could not load says why, in place of its data: a request refused outside the administration
 * network or by the role must not look like an empty list or keep saying «Cargando…».
 */
export function LoadFailed({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-2 flex flex-wrap items-start gap-2 rounded-lg border border-[#f1b5a8] bg-alert-bg px-3 py-2 text-sm text-st-sobrecupo-ink">
      <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="flex items-center gap-1 rounded-md border border-current px-2 py-0.5 text-xs font-medium">
          <RefreshCw aria-hidden className="h-3 w-3" />Reintentar
        </button>
      )}
    </div>
  );
}
