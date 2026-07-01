import type { ReactNode } from "react";

/**
 * Token-styled `<select>` for table/toolbar filters — replaces the per-table
 * inline "SELECT_CLS" strings. Pass `<option>`s as children.
 */
export function FilterSelect({
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`px-2.5 py-2 rounded-lg border border-ds-border bg-ds-surface text-sm text-ds-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow ${className}`}
    >
      {children}
    </select>
  );
}
