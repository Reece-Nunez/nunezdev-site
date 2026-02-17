'use client';

import { useState } from 'react';

interface Client {
  id: string;
  name: string;
  email: string;
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

interface ProjectUpload {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string | null;
  status: string;
  createdAt: string;
}

interface ProjectsTabProps {
  projects: Project[];
  clients: Client[];
  isLoading: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onMutate: () => void;
  onPreviewImage: (url: string, fileName: string) => void;
}

export default function ProjectsTab({
  projects,
  clients,
  isLoading,
  showToast,
  onMutate,
  onPreviewImage,
}: ProjectsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectClientId, setProjectClientId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectUploads, setProjectUploads] = useState<ProjectUpload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);

  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmDeleteUpload, setConfirmDeleteUpload] = useState<string | null>(null);
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectClientId || !projectName) return;

    setCreatingProject(true);

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
        showToast(`Project "${projectName}" created!`, 'success');
        setProjectName('');
        setProjectDescription('');
        setProjectClientId('');
        setShowCreateForm(false);
        onMutate();
      } else {
        showToast(data.error || 'Failed to create project', 'error');
      }
    } catch {
      showToast('Something went wrong', 'error');
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleToggleProject(projectId: string) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      setProjectUploads([]);
      return;
    }

    setExpandedProjectId(projectId);
    setLoadingUploads(true);
    setProjectUploads([]);

    try {
      const res = await fetch(`/api/dashboard/client-projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectUploads(data.uploads || []);
      }
    } catch (error) {
      console.error('Error fetching uploads:', error);
    } finally {
      setLoadingUploads(false);
    }
  }

  function handleDownloadFile(url: string, fileName: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDownloadAll() {
    if (!expandedProjectId) return;

    setDownloadingAll(true);
    try {
      const res = await fetch(`/api/dashboard/client-projects/${expandedProjectId}/download`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] || 'files.zip';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download all failed:', error);
      showToast('Failed to download files', 'error');
    }
    setDownloadingAll(false);
  }

  async function handleDeleteUpload(uploadId: string) {
    setDeletingUploadId(uploadId);
    try {
      const res = await fetch(`/api/dashboard/client-uploads/${uploadId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setProjectUploads(prev => prev.filter(u => u.id !== uploadId));
        showToast('File deleted.', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete file', 'error');
      }
    } catch {
      showToast('Failed to delete file', 'error');
    } finally {
      setDeletingUploadId(null);
      setConfirmDeleteUpload(null);
    }
  }

  async function handleDeleteProject(projectId: string) {
    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/dashboard/client-projects/${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (expandedProjectId === projectId) {
          setExpandedProjectId(null);
          setProjectUploads([]);
        }
        showToast('Project deleted.', 'success');
        onMutate();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete project', 'error');
      }
    } catch {
      showToast('Failed to delete project', 'error');
    } finally {
      setDeletingProjectId(null);
      setConfirmDeleteProject(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create Button / Form */}
      <div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Project
        </button>

        {showCreateForm && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Upload Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingProject || !projectClientId || !projectName}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-gray-500">No projects found.</p>
            <p className="text-sm text-gray-400 mt-1">Create a project to start collecting uploads.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Created</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projects.map((project) => (
                    <>
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{project.name}</p>
                          {project.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{project.clientName}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            project.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : project.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {project.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleProject(project.id)}
                              className={`p-1.5 rounded transition-colors ${
                                expandedProjectId === project.id
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                              }`}
                              title={expandedProjectId === project.id ? 'Collapse' : 'View files'}
                            >
                              <svg className={`w-5 h-5 transition-transform ${expandedProjectId === project.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {confirmDeleteProject === project.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteProject(project.id)}
                                  disabled={deletingProjectId === project.id}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deletingProjectId === project.id ? '...' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteProject(null)}
                                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteProject(project.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete project"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedProjectId === project.id && (
                        <tr key={`${project.id}-files`}>
                          <td colSpan={5} className="p-0">
                            <FileDrawer
                              uploads={projectUploads}
                              loading={loadingUploads}
                              downloadingAll={downloadingAll}
                              confirmDeleteUpload={confirmDeleteUpload}
                              deletingUploadId={deletingUploadId}
                              onDownloadFile={handleDownloadFile}
                              onDownloadAll={handleDownloadAll}
                              onPreviewImage={onPreviewImage}
                              onDeleteUpload={handleDeleteUpload}
                              onConfirmDelete={setConfirmDeleteUpload}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {projects.map((project) => (
                <div key={project.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{project.clientName}</p>
                        {project.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          project.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleProject(project.id)}
                          className={`p-1.5 rounded transition-colors ${
                            expandedProjectId === project.id
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProjectId === project.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {confirmDeleteProject === project.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={deletingProjectId === project.id}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                            >
                              {deletingProjectId === project.id ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteProject(null)}
                              className="px-2 py-1 text-xs text-gray-500"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteProject(project.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedProjectId === project.id && (
                    <FileDrawer
                      uploads={projectUploads}
                      loading={loadingUploads}
                      downloadingAll={downloadingAll}
                      confirmDeleteUpload={confirmDeleteUpload}
                      deletingUploadId={deletingUploadId}
                      onDownloadFile={handleDownloadFile}
                      onDownloadAll={handleDownloadAll}
                      onPreviewImage={onPreviewImage}
                      onDeleteUpload={handleDeleteUpload}
                      onConfirmDelete={setConfirmDeleteUpload}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// File Drawer Component (inline)
interface FileDrawerProps {
  uploads: ProjectUpload[];
  loading: boolean;
  downloadingAll: boolean;
  confirmDeleteUpload: string | null;
  deletingUploadId: string | null;
  onDownloadFile: (url: string, fileName: string) => void;
  onDownloadAll: () => void;
  onPreviewImage: (url: string, fileName: string) => void;
  onDeleteUpload: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
}

function FileDrawer({
  uploads,
  loading,
  downloadingAll,
  confirmDeleteUpload,
  deletingUploadId,
  onDownloadFile,
  onDownloadAll,
  onPreviewImage,
  onDeleteUpload,
  onConfirmDelete,
}: FileDrawerProps) {
  const completedUploads = uploads.filter(u => u.status === 'completed');

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin h-6 w-6 border-3 border-yellow-400 border-t-transparent rounded-full" />
        </div>
      ) : uploads.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No files uploaded yet.</p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-700">
              {completedUploads.length} file{completedUploads.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={onDownloadAll}
              disabled={downloadingAll || completedUploads.filter(u => u.url).length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingAll ? 'Downloading...' : 'Download All'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
              >
                {upload.mimeType.startsWith('image/') && upload.url ? (
                  <button
                    onClick={() => onPreviewImage(upload.url!, upload.fileName)}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:ring-2 hover:ring-yellow-400 transition-all cursor-pointer"
                  >
                    <img
                      src={upload.url}
                      alt={upload.fileName}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{upload.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {upload.fileSize >= 1048576
                      ? `${(upload.fileSize / 1048576).toFixed(1)} MB`
                      : `${(upload.fileSize / 1024).toFixed(1)} KB`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {upload.url && (
                    <button
                      onClick={() => onDownloadFile(upload.url!, upload.fileName)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )}
                  {confirmDeleteUpload === upload.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDeleteUpload(upload.id)}
                        disabled={deletingUploadId === upload.id}
                        className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingUploadId === upload.id ? '...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => onConfirmDelete(null)}
                        className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onConfirmDelete(upload.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
