import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Portal - NunezDev',
  description: 'Upload files and manage your projects',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        body > nav, body > footer { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
