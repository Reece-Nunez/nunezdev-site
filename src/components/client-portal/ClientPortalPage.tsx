'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import ClientPortalStats from './ClientPortalStats';
import PortalUsersTab from './PortalUsersTab';
import ProjectsTab from './ProjectsTab';
import ImagePreviewModal from './ImagePreviewModal';

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
  createdAt: string;
  clientId: string;
  clientName: string;
}

interface ClientsResponse {
  clients: Client[];
}

interface PortalUsersResponse {
  users: PortalUser[];
}

interface ProjectsResponse {
  projects: Project[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ClientPortalPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('projects');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; fileName: string } | null>(null);

  const { showToast, ToastContainer } = useToast();

  // SWR data fetching with URL-keyed queries
  const { data: clientsData } = useSWR<ClientsResponse>('/api/clients', fetcher);

  const usersUrl = selectedClientId
    ? `/api/dashboard/portal-users?clientId=${selectedClientId}`
    : '/api/dashboard/portal-users';
  const { data: usersData, isLoading: usersLoading, mutate: mutateUsers } = useSWR<PortalUsersResponse>(usersUrl, fetcher);

  const projectsUrl = selectedClientId
    ? `/api/dashboard/client-projects?clientId=${selectedClientId}`
    : '/api/dashboard/client-projects';
  const { data: projectsData, isLoading: projectsLoading, mutate: mutateProjects } = useSWR<ProjectsResponse>(projectsUrl, fetcher);

  const clients = clientsData?.clients || [];
  const users = usersData?.users || [];
  const projects = projectsData?.projects || [];

  // Client-side search filtering
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.clientName.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Stats calculations
  const totalClients = clients.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const totalUsers = users.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const tabs = [
    { id: 'users' as const, label: 'Users', count: filteredUsers.length },
    { id: 'projects' as const, label: 'Projects', count: filteredProjects.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 mt-1">Manage client access, projects, and uploads</p>
      </div>

      {/* Stats */}
      <ClientPortalStats
        totalClients={totalClients}
        activeUsers={activeUsers}
        totalUsers={totalUsers}
        activeProjects={activeProjects}
        completedProjects={completedProjects}
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects and users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-yellow-400 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <PortalUsersTab
          users={filteredUsers}
          clients={clients}
          isLoading={usersLoading}
          showToast={showToast}
          onMutate={() => mutateUsers()}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectsTab
          projects={filteredProjects}
          clients={clients}
          isLoading={projectsLoading}
          showToast={showToast}
          onMutate={() => mutateProjects()}
          onPreviewImage={(url, fileName) => setPreviewImage({ url, fileName })}
        />
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}
