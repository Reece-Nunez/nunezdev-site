// app/dashboard/dashboard-client.tsx
'use client';

import AutoLogoutProvider from "@/components/AutoLogoutProvider";
import { BulkRunProvider } from "./BulkRunProvider";

export default function DashboardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // Toaster moved to the root layout (single app-wide pipeline) — no per-shell
  // Toaster here, or toasts would render twice on the dashboard.
  // BulkRunProvider lives at the layout level so the bulk-run progress bar
  // survives navigation between dashboard pages (it renders a fixed bar itself).
  return (
    <AutoLogoutProvider timeoutMinutes={30} warningMinutes={5}>
      <BulkRunProvider>{children}</BulkRunProvider>
    </AutoLogoutProvider>
  );
}