// app/dashboard/dashboard-client.tsx
'use client';

import AutoLogoutProvider from "@/components/AutoLogoutProvider";

export default function DashboardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AutoLogoutProvider timeoutMinutes={30} warningMinutes={5}>
      {children}
    </AutoLogoutProvider>
  );
}