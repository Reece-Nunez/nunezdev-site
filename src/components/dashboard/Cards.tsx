'use client';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function Cards({
  kpis,
}: {
  kpis: {
    clientsCount: number;
    openDealsCount: number;
    pipelineValue: number;
    revenueThisMonth: number;
    outstandingBalance: number;
  };
}) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
    });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <Card label="Clients" value={kpis.clientsCount.toString()} />
      <Card label="Open Deals" value={kpis.openDealsCount.toString()} />
      <Card label="Pipeline Value" value={fmt(kpis.pipelineValue)} />
      <Card label="Revenue (This Month)" value={fmt(kpis.revenueThisMonth)} />
      <Card label="Outstanding" value={fmt(kpis.outstandingBalance)} />
    </div>
  );
}
