// app/dashboard/dashboard-client.tsx
'use client';

import AutoLogoutProvider from "@/components/AutoLogoutProvider";

export default function DashboardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // Toaster moved to the root layout (single app-wide pipeline) — no per-shell
  // Toaster here, or toasts would render twice on the dashboard.
  return (
    <AutoLogoutProvider timeoutMinutes={30} warningMinutes={5}>
      {children}
    </AutoLogoutProvider>
  );
}