export function currency(cents: number | null | undefined): string {
  const v = Math.max(0, Number(cents ?? 0)) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
export function prettyDate(iso?: string | null) {
  if (!iso) return '—';

  // Handle date-only strings (YYYY-MM-DD) without timezone conversion
  if (iso.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = iso.split('-').map(Number);
    const d = new Date(year, month - 1, day); // Create date in local timezone
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  }

  // Handle full datetime strings normally
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
