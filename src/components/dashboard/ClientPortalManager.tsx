'use client';

import { useState, useEffect } from 'react';

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

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clientId: string;
  clientName: string;
}

export default function ClientPortalManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedClientId, setSelectedClientId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectClientId, setProjectClientId] = useState('');

  const [inviting, setInviting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [clientsRes, usersRes, projectsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/dashboard/portal-users'),
        fetch('/api/dashboard/client-projects'),
      ]);

      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients || data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setPortalUsers(data.users || []);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !inviteEmail) return;

    setInviting(true);
    setMessage(null);

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
        setMessage({ type: 'success', text: `Invite sent to ${inviteEmail}!` });
        setInviteEmail('');
        setSelectedClientId('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to invite client' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setInviting(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectClientId || !projectName) return;

    setCreatingProject(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/client-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: projectClientId,
          name: projectName,
          description: projectDescription || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `Project "${projectName}" created!` });
        setProjectName('');
        setProjectDescription('');
        setProjectClientId('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create project' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setCreatingProject(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 mt-1">Manage client access and upload projects</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Invite Client */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Client to Portal</h2>
          <form onSubmit={handleInviteClient} className="space-y-4">
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
            <button
              type="submit"
              disabled={inviting || !selectedClientId || !inviteEmail}
              className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviting ? 'Sending Invite...' : 'Send Portal Invite'}
            </button>
          </form>
        </div>

        {/* Create Project */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Upload Project</h2>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Client
              </label>
              <select
                value={projectClientId}
                onChange={(e) => setProjectClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                required
              >
                <option value="">Choose a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Kitchen Remodel Photos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="e.g., Upload before/after photos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={creatingProject || !projectClientId || !projectName}
              className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingProject ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
      </div>

      {/* Portal Users List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Portal Users</h2>
        {portalUsers.length === 0 ? (
          <p className="text-gray-500 text-sm">No clients have been invited yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Client</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {portalUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{user.clientName}</td>
                    <td className="py-2 px-3">{user.email}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Projects</h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">No projects created yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{project.clientName}</p>
                {project.description && (
                  <p className="text-sm text-gray-400 mt-2">{project.description}</p>
                )}
                <span className={`inline-flex mt-3 px-2 py-1 text-xs rounded-full ${project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
