import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

// primary = the brand accent (yellow + black) used for the one main action.
// secondary = neutral surface button. ghost = borderless. danger = destructive.
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90",
  secondary:
    "bg-ds-surface text-ds-text border border-ds-border hover:bg-ds-surface-2",
  ghost:
    "bg-transparent text-ds-text border border-transparent hover:bg-ds-surface-2",
  danger: "bg-ds-danger text-white border border-ds-danger hover:bg-ds-danger/90",
};

const SIZE: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-3 py-2 text-sm gap-2",
};

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

/**
 * Shared button. Covers all interaction states in one place:
 * default · hover (per variant) · focus-visible (brand ring, keyboard only) ·
 * active (press) · disabled · loading (spinner + disabled). Consumes the
 * design tokens so surfaces/borders/text stay consistent app-wide.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, leftIcon, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-1 " +
        "active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0 " +
        `${VARIANT[variant]} ${SIZE[size]} ${className}`
      }
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
    </button>
  );
});
