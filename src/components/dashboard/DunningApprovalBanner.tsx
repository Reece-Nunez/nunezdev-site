"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

type ApprovalTier = "shutdown" | "chronic_direct";

interface Approval {
  id: string;
  tier: ApprovalTier;
  invoice_id: string;
  client_name: string | null;
  invoice_number: string | null;
  amount_cents: number;
  days_overdue: number;
  body: string;
  created_at: string;
}

const TIER_LABEL: Record<ApprovalTier, string> = {
  shutdown: "shutdown notice",
  chronic_direct: "past-due notice",
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/**
 * Dashboard banner for the shutdown-tier SMS approval queue. These are the
 * "your site could be shut down" texts the cron will NEVER auto-send. The owner
 * approves (sends) or dismisses each one here. Renders nothing when the queue is
 * empty, so it's safe to mount unconditionally at the top of the dashboard.
 */
export default function DunningApprovalBanner() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dunning-approvals");
      if (res.ok) {
        const json = await res.json();
        setApprovals(json.approvals ?? []);
      }
    } catch {
      // Silent: a failed fetch just leaves the banner hidden.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(async (id: string, action: "approve" | "dismiss") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/dunning-approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== id));
        toast.success(action === "approve" ? "Shutdown notice sent" : "Dismissed");
      } else if (res.status === 409) {
        // Quiet hours / opted out / already texted today — stays queued.
        toast.error(`Couldn't send right now: ${json.reason ?? "try again later"}`);
      } else {
        toast.error("Something went wrong");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  }, []);

  // Destructive action gets an inline confirm (no window.confirm per house rules).
  const confirmApprove = useCallback(
    (a: Approval) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <span className="text-sm">
              Send the shutdown notice to <strong>{a.client_name ?? "this client"}</strong> for{" "}
              {fmt(a.amount_cents)}?
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  toast.dismiss(t.id);
                  act(a.id, "approve");
                }}
              >
                Send it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toast.dismiss(t.id)}>
                Cancel
              </Button>
            </div>
          </div>
        ),
        { duration: Infinity },
      );
    },
    [act],
  );

  if (!loaded || approvals.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="font-semibold text-red-800">
          {approvals.length} SMS {approvals.length === 1 ? "notice" : "notices"} awaiting your approval
        </h2>
      </div>
      <p className="text-sm text-red-700/90 mb-4">
        These are the harshest dunning texts. Nothing sends until you approve it.
      </p>

      <ul className="space-y-3">
        {approvals.map((a) => (
          <li key={a.id} className="rounded-lg border border-red-200 bg-white p-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                      (a.tier === "chronic_direct"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700")
                    }
                  >
                    {TIER_LABEL[a.tier] ?? a.tier}
                  </span>
                  {a.client_name ?? "Unknown client"}{" "}
                  <span className="text-gray-500 font-normal">
                    · {a.invoice_number ?? a.invoice_id.slice(0, 8)} · {fmt(a.amount_cents)} ·{" "}
                    {a.days_overdue} days overdue
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                  {a.body}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === a.id}
                  onClick={() => confirmApprove(a)}
                >
                  Approve &amp; Send
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === a.id}
                  onClick={() => act(a.id, "dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
