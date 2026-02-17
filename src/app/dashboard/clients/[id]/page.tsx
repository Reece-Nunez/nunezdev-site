import ClientDetailContent from './ClientDetailContent';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  return <ClientDetailContent clientId={clientId} />;
}
