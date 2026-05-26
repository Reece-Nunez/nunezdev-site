// Minimal GA4 event helper. The gtag() global is loaded by the script
// tag in app/layout.tsx — this just gives us a typed, safe call site.
//
// Usage:
//   import { trackEvent } from "@/lib/gtag";
//   trackEvent("book_consult_click", { location: "hero" });
//
// All events should use snake_case names. Recommended events for the
// lead-gen funnel:
//   - book_consult_click  — visitor clicks any "Book a free consult" CTA
//   - lead_form_submit    — contact form / booking form successful POST
//   - payment_link_open   — user opens a Stripe payment link

type GtagWindow = Window & {
  gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
};

export function trackEvent(
  eventName: string,
  params: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;
  if (typeof w.gtag !== "function") return;
  try {
    w.gtag("event", eventName, params);
  } catch {
    // Never let analytics throw into the UI path.
  }
}
