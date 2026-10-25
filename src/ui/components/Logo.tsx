/** CampusNexo mark in the UCC palette: cyan peak, green and lime nodes on navy. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--color-night)" />
      <path d="M8 21 16 9l8 12" fill="none" stroke="var(--color-signal)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="16" cy="21" r="2.6" fill="var(--color-ucc-verde)" />
      <circle cx="24" cy="21" r="1.6" fill="var(--color-ucc-lima)" />
    </svg>
  );
}
