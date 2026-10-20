import { AlertTriangle, Info } from 'lucide-react';
import { useTwin } from '../../application/TwinContext';

export function Notices() {
  const { notices } = useTwin();
  return (
    <div className="pointer-events-none fixed bottom-16 right-4 md:bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-[0_6px_20px_-8px_rgba(29,38,43,0.35)] ${notice.tone === 'error' ? 'border-st-sobrecupo/40 bg-[#fdf1ee] text-[#8a2f1f]' : 'border-rule bg-sheet text-ink'}`}
        >
          {notice.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-st-optimo" />}
          <span>{notice.text}</span>
        </div>
      ))}
    </div>
  );
}
