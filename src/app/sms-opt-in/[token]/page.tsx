import { Metadata } from 'next';
import SmsOptInClient from './SmsOptInClient';

export const metadata: Metadata = {
  title: 'Opt in to SMS reminders',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SmsOptInPage({ params }: PageProps) {
  const { token } = await params;
  return <SmsOptInClient token={token} />;
}
