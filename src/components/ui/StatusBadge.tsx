import { Badge, type BadgeTone } from "./Badge";

interface StatusBadgeProps {
  status: string;
  isSuspended?: boolean;
  className?: string;
}

// Invoice status → shared Badge tone. Delegates to the Badge primitive so
// invoice badges match every other status chip in the app.
const INVOICE_STATUS_TONE: Record<string, BadgeTone> = {
  paid: "success",
  sent: "info",
  draft: "neutral",
  overdue: "danger",
  partially_paid: "warning",
  void: "muted",
};

export function InvoiceStatusBadge({ status, isSuspended, className = "" }: StatusBadgeProps) {
  const tone: BadgeTone = isSuspended
    ? "warning"
    : INVOICE_STATUS_TONE[status?.toLowerCase()] ?? "neutral";
  const label = isSuspended
    ? "Suspended"
    : status?.toLowerCase() === "partially_paid"
      ? "Partially Paid"
      : status
        ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
        : "Unknown";

  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

