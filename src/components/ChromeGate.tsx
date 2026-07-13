"use client";

import { usePathname } from "next/navigation";

// Mockup routes (e.g. /mockups/alexceeper) are full-bleed client demos — the
// global NunezDev Navbar/Footer would break the illusion that it's the client's
// own site. Public proposal pages (/proposal/<token>) are the same: a client is
// reviewing a document meant to feel like a focused, self-contained proposal, so
// the marketing nav ("Let's get building" CTA) and footer are noise there.
// Gate the shared chrome off for those paths. usePathname works during SSR in
// the app router, so there's no flash of the navbar on load.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/mockups") || pathname?.startsWith("/proposal")) return null;
  return <>{children}</>;
}
