'use client';

type ActivityItem = {
  type: 'note' | 'deal' | 'invoice' | 'task';
  data: {
    body?: string;
    title?: string;
    stage?: string;
    status?: string;
    amount_cents?: number;
    done?: boolean;
  };
  ts: string;
};

function pretty(ts: string) {
  // Dummy implementation, replace with your own
  return new Date(ts).toLocaleString();
}

export default function RecentActivity() {
  // Replace this with your actual data fetching logic
  const items: ActivityItem[] = [];

  return (
    <div>
      <ul>
        {items.map((it: ActivityItem, idx: number) => (
          <li key={idx} className="flex items-start gap-3 border-b last:border-none pb-2">
            <span className="mt-1 inline-block w-2 h-2 rounded-full bg-gray-400" />
            <div className="flex-1">
              <div className="text-gray-800">
                {it.type === 'note' && <>Note added: <span className="text-gray-600">{it.data.body?.slice(0,80)}</span></>}
                {it.type === 'deal' && <>Deal created: <strong>{it.data.title}</strong> <span className="text-gray-500">({it.data.stage})</span></>}
                {it.type === 'invoice' && <>Invoice {it.data.status}: <strong>${((it.data.amount_cents ?? 0)/100).toLocaleString()}</strong></>}
                {it.type === 'task' && <>Task {it.data.done ? 'completed' : 'created'}: <strong>{it.data.title}</strong></>}
              </div>
              <div className="text-xs text-gray-500">{pretty(it.ts)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
