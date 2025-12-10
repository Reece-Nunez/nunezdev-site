'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { ClientOverview } from '@/types/client_detail';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

type ClientStatus = 'Lead' | 'Prospect' | 'Active' | 'Past';

export default function ClientForm({ clientId }: { clientId: string }) {

  interface ClientSWRResponse {
    client: ClientOverview;
  }

  const router = useRouter();
  const { data, mutate } = useSWR<ClientSWRResponse>(`/api/clients/${clientId}`, (u: string) => fetch(u).then((r) => r.json()));
  const client = data?.client;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toasts, success, error, removeToast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'Lead' as ClientStatus,
    tags: [] as string[]
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when client loads
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        company: client.company ?? '',
        status: client.status as ClientStatus,
        tags: client.tags ?? []
      });
    }
  }, [client]);

  if (!client) return <div className="p-4">Loading…</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save client');
      }
      
      mutate();
      setHasChanges(false);
      success('Client saved successfully!');
    } catch (err) {
      console.error('Failed to save client:', err);
      error(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof typeof formData, value: any) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }

  async function handleDelete() {
    if (!client) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete client');
      }
      
      const data = await response.json();
      success(data.message || 'Client deleted successfully!');
      
      // Navigate back to clients list after a brief delay
      setTimeout(() => {
        router.push('/dashboard/clients');
      }, 1500);
      
    } catch (err) {
      console.error('Failed to delete client:', err);
      error(err instanceof Error ? err.message : 'Failed to delete client');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Client</h2>
        <span className="text-xs text-gray-500">{saving ? 'Saving…' : hasChanges ? 'Unsaved changes' : ''}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field 
          label="Name" 
          value={formData.name} 
          onChange={(v) => updateField('name', v)} 
        />
        <Field 
          label="Email" 
          value={formData.email} 
          onChange={(v) => updateField('email', v)} 
          type="email"
        />
        <Field 
          label="Phone" 
          value={formData.phone} 
          onChange={(v) => updateField('phone', v)} 
          type="tel"
        />
        <Field 
          label="Company" 
          value={formData.company} 
          onChange={(v) => updateField('company', v)} 
        />
        <Select
          label="Status"
          value={formData.status}
          options={['Lead','Prospect','Active','Past']}
          onChange={(v) => updateField('status', v as ClientStatus)}
        />
        <Field
          label="Tags (comma separated)"
          value={formData.tags.join(', ')}
          onChange={(v) => updateField('tags', v.split(',').map(s => s.trim()).filter(Boolean))}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Invoiced" value={client.total_invoiced_cents} />
        <Stat label="Paid" value={client.total_paid_cents} />
        <Stat label="Balance Due" value={client.balance_due_cents} />
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting...' : 'Delete Client'}
        </button>
        
        <button
          type="submit"
          disabled={!hasChanges || saving || deleting}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-red-600">Delete Client</h3>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <strong>{client?.name}</strong>?
              </p>
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                <strong>Warning:</strong> This will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All client information</li>
                  <li>All invoices and payments</li>
                  <li>All notes and tasks</li>
                </ul>
                <p className="mt-2"><strong>This action cannot be undone!</strong></p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type={type}
        className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=""
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <select
        className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const dollars = (value ?? 0) / 100;
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-gray-500">{label}</div>
      <div className="text-lg font-semibold">${dollars.toLocaleString()}</div>
    </div>
  );
}
