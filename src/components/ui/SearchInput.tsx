import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

/**
 * Search box with a leading magnifying-glass icon — the shape every table
 * toolbar was re-declaring inline. Token-styled for consistency.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlassIcon className="w-4 h-4 text-ds-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-ds-border bg-ds-surface text-sm text-ds-text placeholder:text-ds-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
      />
    </div>
  );
}
