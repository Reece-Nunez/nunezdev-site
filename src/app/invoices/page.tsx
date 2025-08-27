'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type InvoiceRow = {
    id: string;
    client_id: string | null;
    status: 'draft' | 'sent' | 'paid' | 'void' | 'overdue';
    amount_cents: number;
    issued_at: string | null;
    due_at: string | null;
    stripe_invoice_id: string | null;
    clients?: { id: string; name: string | null; email: string | null } | null;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

function currency(cents?: number | null) {
    const v = (cents ?? 0) / 100;
    return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
function prettyDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString();
}
function StatusBadge({ s }: { s: InvoiceRow['status'] }) {
    const map: Record<InvoiceRow['status'], string> = {
        draft: 'bg-gray-100 text-gray-700',
        sent: 'bg-indigo-100 text-indigo-700',
        paid: 'bg-emerald-100 text-emerald-700',
        void: 'bg-yellow-100 text-yellow-800',
        overdue: 'bg-red-100 text-red-700',
    };
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[s]}`}>{s}</span>;
}

export default function InvoicesPage() {
    const { data, mutate } = useSWR<{ invoices: InvoiceRow[] }>('/api/invoices', fetcher);
    const [deleting, setDeleting] = useState<string | null>(null);

    const rows = useMemo(() => data?.invoices ?? [], [data]);
    const totals = useMemo(() => {
        const t = { total: 0, paid: 0, due: 0 };
        for (const r of rows) {
            t.total += r.amount_cents ?? 0;
            if (r.status === 'paid') t.paid += r.amount_cents ?? 0;
            if (r.status === 'sent' || r.status === 'overdue') t.due += r.amount_cents ?? 0;
        }
        return t;
    }, [rows]);

    async function deleteInvoice(id: string) {
        if (!confirm('Delete this invoice? If present in Stripe it will be voided/deleted.')) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/invoices/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hard: true }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || 'Delete failed');
            mutate();
        } finally {
            setDeleting(null);
        }
    }

    return (
        <div className="p-6 my-36 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Invoices</h1>
                <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="rounded border px-3 py-2 hover:bg-gray-50"
                >
                    Dashboard
                </button>
            </div>


            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-600">Invoiced</div>
                    <div className="mt-1 text-xl font-semibold">{currency(totals.total)}</div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-600">Paid</div>
                    <div className="mt-1 text-xl font-semibold">{currency(totals.paid)}</div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-600">Balance Due</div>
                    <div className="mt-1 text-xl font-semibold">{currency(totals.due)}</div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                        <tr>
                            <th className="px-3 py-2">Client</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2">Issued</th>
                            <th className="px-3 py-2">Due</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                                <td className="px-3 py-2">
                                    <div className="font-medium">
                                        {r.clients?.name ?? '—'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {r.clients?.email ?? '—'}
                                    </div>
                                </td>
                                <td className="px-3 py-2"><StatusBadge s={r.status} /></td>
                                <td className="px-3 py-2 text-right">{currency(r.amount_cents)}</td>
                                <td className="px-3 py-2">{prettyDate(r.issued_at)}</td>
                                <td className="px-3 py-2">{prettyDate(r.due_at)}</td>
                                <td className="px-3 py-2">
                                    <div className="flex justify-end gap-3">
                                        {r.client_id ? (
                                            <Link
                                                href={`/clients/${r.client_id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                View client
                                            </Link>
                                        ) : <span className="text-gray-400">No client</span>}
                                        {r.stripe_invoice_id ? (
                                            <a
                                                href={`https://dashboard.stripe.com/invoices/${r.stripe_invoice_id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-indigo-600 hover:underline"
                                            >
                                                Open in Stripe
                                            </a>
                                        ) : null}
                                        <button
                                            onClick={() => deleteInvoice(r.id)}
                                            disabled={deleting === r.id}
                                            className="text-red-600 hover:underline disabled:opacity-60"
                                        >
                                            {deleting === r.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await fetch(`/api/invoices/${r.id}/resync`, { method: 'POST' });
                                                mutate();
                                            }}
                                            className="text-gray-500 hover:underline"
                                        >
                                            Resync
                                        </button>

                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr className="border-t">
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                                    No invoices yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
