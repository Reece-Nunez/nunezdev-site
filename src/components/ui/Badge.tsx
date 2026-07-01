import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "muted"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

// Semantic status colors (success/danger/warning/info) — NOT the interactive
// brand accent, which is reserved for buttons + selected nav. `brand` exists
// for the rare badge that should read as the brand chip.
const TONE: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  muted: "bg-gray-50 text-gray-500 border-gray-200",
  brand: "bg-brand-yellow/15 text-brand-black border-brand-yellow/40",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const SIZE = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
} as const;

/**
 * Chip/badge primitive — the single owner of pill styling (radius, border,
 * weight) so pages stop re-declaring inline status-color maps. `tone` carries
 * a semantic status color or the brand accent; domain code maps its own values
 * (client status, invoice status, …) to a tone.
 */
export function Badge({
  tone = "neutral",
  size = "md",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  size?: keyof typeof SIZE;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${SIZE[size]} ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
