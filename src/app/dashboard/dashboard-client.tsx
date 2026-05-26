// app/dashboard/dashboard-client.tsx
'use client';

import { Toaster } from "react-hot-toast";
import AutoLogoutProvider from "@/components/AutoLogoutProvider";

export default function DashboardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AutoLogoutProvider timeoutMinutes={30} warningMinutes={5}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: "10px", background: "#1f2937", color: "#fff" },
        }}
      />
    </AutoLogoutProvider>
  );
}