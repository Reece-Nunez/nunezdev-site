"use client";

import { usePathname } from "next/navigation";

// Mockup routes (e.g. /mockups/alexceeper) are full-bleed client demos — the
// global NunezDev Navbar/Footer would break the illusion that it's the client's
// own site. Gate the shared chrome off for those paths only. usePathname works
// during SSR in the app router, so there's no flash of the navbar on load.
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/mockups")) return null;
  return <>{children}</>;
}
