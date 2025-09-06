import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice - NunezDev",
  description: "Secure invoice viewing and payment portal",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US" dir="ltr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}