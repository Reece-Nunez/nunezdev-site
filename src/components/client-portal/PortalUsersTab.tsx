'use client';

import { useState } from 'react';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface PortalUser {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  clientId: string;
  clientName: string;
}

interface PortalUsersTabProps {
  users: PortalUser[];
  clients: Client[];
  isLoading: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onMutate: () => void;
}

export default function PortalUsersTab({
  users,
  clients,
  isLoading,
  showToast,
  onMutate,
}: PortalUsersTabProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  async function handleInviteClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !inviteEmail) return;

    setInviting(true);

    try {
      const res = await fetch('/api/dashboard/portal-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          email: inviteEmail,
          sendInvite: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Invite sent to ${inviteEmail}!`, 'success');
        setInviteEmail('');
        setSelectedClientId('');
        setShowInviteForm(false);
        onMutate();
      } else {
        showToast(data.error || 'Failed to invite client', 'error');
      }
    } catch {
      showToast('Something went wrong', 'error');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Invite Button / Form */}
      <div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite Client
        </button>

        {showInviteForm && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Client to Portal</h3>
            <form onSubmit={handleInviteClient} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Client
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      const client = clients.find(c => c.id === e.target.value);
                      if (client?.email) setInviteEmail(client.email);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.email ? `(${client.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={inviting || !selectedClientId || !inviteEmail}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? 'Sending...' : 'Send Portal Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-gray-500">No portal users found.</p>
            <p className="text-sm text-gray-400 mt-1">Invite a client to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{user.clientName}</td>
                      <td className="py-3 px-4 text-gray-600">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{user.clientName}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{user.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Last login: {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
