/**
 * Invoice view tracking — pure logic shared by the public invoice route and the
 * dashboard display. "Viewed" means the client opened the public invoice link
 * (works the same whether the link arrived by email or text).
 */

export interface InvoiceViewState {
  viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number | null;
}

export interface InvoiceViewUpdate {
  viewed_at?: string; // set only on the first ever view
  last_viewed_at: string;
  view_count: number;
}

// Collapse duplicate hits from a single visit: React can fire the public
// fetch more than once per page load (re-render / strict mode), and a client
// refreshing within a few seconds isn't a new "view". A hit within this window
// of the last view updates nothing.
export const VIEW_DEBOUNCE_MS = 30_000;

/**
 * Given the current stored view state and the time of a fresh open, return the
 * fields to persist — or null if this open falls inside the debounce window and
 * should be ignored. First open also stamps viewed_at.
 */
export function computeInvoiceViewUpdate(
  current: InvoiceViewState,
  nowIso: string,
  debounceMs: number = VIEW_DEBOUNCE_MS
): InvoiceViewUpdate | null {
  const now = new Date(nowIso).getTime();
  const lastMs = current.last_viewed_at ? new Date(current.last_viewed_at).getTime() : null;

  if (lastMs !== null && now - lastMs < debounceMs) return null;

  const update: InvoiceViewUpdate = {
    last_viewed_at: nowIso,
    view_count: (current.view_count ?? 0) + 1,
  };
  if (!current.viewed_at) update.viewed_at = nowIso;
  return update;
}

/** Short human summary for the dashboard, e.g. "Viewed 3× · last Jul 22". */
export function formatInvoiceViewedSummary(state: InvoiceViewState): string {
  if (!state.viewed_at) return 'Not yet viewed';
  const count = state.view_count ?? 1;
  const times = count === 1 ? 'Viewed once' : `Viewed ${count}×`;
  const lastStr = state.last_viewed_at
    ? new Date(state.last_viewed_at).toLocaleDateString()
    : null;
  return lastStr ? `${times} · last ${lastStr}` : times;
}
