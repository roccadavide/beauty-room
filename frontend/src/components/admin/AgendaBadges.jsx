// Small presentational badges for the admin agenda (Editorial Beauty).
// VerifiedBadge — gold "trusted customer" checkmark, shown next to a customer name.
// OnlineBadge   — "Prenotato online" pill for customer-made pay-in-store bookings.

export function VerifiedBadge({ size = 14, className = "" }) {
  return (
    <span
      className={`ag-verified ${className}`.trim()}
      role="img"
      aria-label="Cliente di fiducia"
      title="Cliente di fiducia"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <path
          d="M7 12.4l3.3 3.3L17 9"
          fill="none"
          stroke="#fffdf8"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function OnlineBadge({ className = "" }) {
  return <span className={`ag-badge-online ${className}`.trim()}>Prenotato online</span>;
}
