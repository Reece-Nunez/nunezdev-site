'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import FileDropzone, { UploadedFileInfo } from '@/components/portal/FileDropzone';
import UploadProgress, { UploadFile } from '@/components/portal/UploadProgress';
import UploadSuccessAnimation from '@/components/portal/UploadSuccessAnimation';
import ProjectCard from '@/components/portal/ProjectCard';
import SmsConsentCard from '@/components/portal/SmsConsentCard';
import { NON_PREVIEWABLE_IMAGE_TYPES, formatBytes } from '@/lib/uploadConstants';

interface Project {
  id: string;
  name: string;
  description: string | null;
  uploadCount: number;
  createdAt: string;
}

interface Session {
  clientName: string;
  email: string;
  hasPassword: boolean;
}

interface ExistingUpload {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string | null;
  status: string;
  createdAt: string;
}

export default function PortalDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [existingUploads, setExistingUploads] = useState<ExistingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/portal/auth/session');
        if (!res.ok) {
          router.push('/portal/login');
          return;
        }
        const data = await res.json();
        setSession({
          clientName: data.clientName,
          email: data.email,
          hasPassword: data.hasPassword,
        });
        // Show password setup prompt if user doesn't have a password
        if (!data.hasPassword) {
          setShowPasswordSetup(true);
        }
      } catch {
        router.push('/portal/login');
      }
    }

    async function fetchProjects() {
      try {
        const res = await fetch('/api/portal/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects);
          if (data.projects.length > 0) {
            setSelectedProject(data.projects[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    }

    checkSession().then(fetchProjects);
  }, [router]);

  useEffect(() => {
    if (!selectedProject) return;

    async function fetchProjectUploads() {
      try {
        const res = await fetch(`/api/portal/projects/${selectedProject!.id}`);
        if (res.ok) {
          const data = await res.json();
          setExistingUploads(data.uploads);
        }
      } catch (error) {
        console.error('Failed to fetch uploads:', error);
      }
    }

    fetchProjectUploads();
  }, [selectedProject]);

  // Cancel any in-progress edit when switching to a different project.
  useEffect(() => {
    setEditingProject(false);
    setEditName('');
    setEditDescription('');
  }, [selectedProject?.id]);

  const matchFile = (a: File, b: File) =>
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

  // Holds the FileDropzone's enqueue function so we can retry failed uploads.
  const retryHandlerRef = useRef<((file: File) => void) | null>(null);

  const handleUploadStart = useCallback((file: File) => {
    setUploads((prev) => {
      // If a retry of a previously-errored upload, reset its state in place.
      const existing = prev.find((u) => matchFile(u.file, file));
      if (existing) {
        return prev.map((u) =>
          matchFile(u.file, file)
            ? { ...u, progress: 0, status: 'uploading', error: undefined }
            : u
        );
      }
      return [...prev, { file, progress: 0, status: 'uploading' }];
    });
  }, []);

  const handleUploadProgress = useCallback((file: File, progress: number) => {
    setUploads((prev) =>
      prev.map((u) =>
        matchFile(u.file, file) ? { ...u, progress } : u
      )
    );
  }, []);

  const handleUploadComplete = useCallback((file: File, info: UploadedFileInfo) => {
    setUploads((prev) =>
      prev.map((u) =>
        matchFile(u.file, file)
          ? { ...u, progress: 100, status: 'complete', url: info.url ?? undefined }
          : u
      )
    );
    setShowSuccess(true);

    // Append directly to existing uploads — avoids the extra round-trip.
    setExistingUploads((prev) => {
      if (prev.some((u) => u.id === info.id)) return prev;
      return [info, ...prev];
    });
  }, []);

  const handleUploadError = useCallback((file: File, error: string) => {
    setUploads((prev) => {
      const exists = prev.some((u) => matchFile(u.file, file));
      if (exists) {
        return prev.map((u) =>
          matchFile(u.file, file) ? { ...u, status: 'error', error } : u
        );
      }
      return [...prev, { file, progress: 0, status: 'error', error }];
    });
    // Surface a quick toast so the user notices even if the error appears
    // far below the dropzone.
    toast.error(error, { duration: 6000 });
  }, []);

  const handleRemoveUpload = useCallback((file: File) => {
    setUploads((prev) => prev.filter((u) => !matchFile(u.file, file)));
  }, []);

  const handleRetryUpload = useCallback((file: File) => {
    if (retryHandlerRef.current) {
      retryHandlerRef.current(file);
    }
  }, []);

  const registerRetry = useCallback((handler: (file: File) => void) => {
    retryHandlerRef.current = handler;
  }, []);

  const handleLogout = async () => {
    await fetch('/api/portal/auth/logout', { method: 'POST' });
    router.push('/portal/login');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSettingPassword(true);
    try {
      const res = await fetch('/api/portal/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        setSession((prev) => prev ? { ...prev, hasPassword: true } : null);
        setShowPasswordSetup(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to set password');
      }
    } catch {
      setPasswordError('Something went wrong');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || creatingProject) return;

    setCreatingProject(true);
    try {
      const res = await fetch('/api/portal/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
        }),
      });

      if (res.ok) {
        const { project } = await res.json();
        setProjects((prev) => [project, ...prev]);
        setSelectedProject(project);
        setShowNewProject(false);
        setNewProjectName('');
        setNewProjectDescription('');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreatingProject(false);
    }
  };

  const startEditingProject = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditDescription(selectedProject.description || '');
    setEditingProject(true);
  };

  const cancelEditingProject = () => {
    setEditingProject(false);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || savingProject) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('Project name can\'t be empty.');
      return;
    }

    const nameChanged = trimmedName !== selectedProject.name;
    const descChanged = (editDescription.trim() || null) !== (selectedProject.description || null);
    if (!nameChanged && !descChanged) {
      cancelEditingProject();
      return;
    }

    setSavingProject(true);
    try {
      const res = await fetch(`/api/portal/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: editDescription.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error || 'Couldn\'t save changes.');
        return;
      }

      const updated = data.project;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? { ...p, name: updated.name, description: updated.description }
            : p
        )
      );
      setSelectedProject((prev) =>
        prev && prev.id === updated.id
          ? { ...prev, name: updated.name, description: updated.description }
          : prev
      );
      cancelEditingProject();
      toast.success('Project updated.');

      if (nameChanged) {
        const moved = data.movedFiles ?? 0;
        const failed = data.moveFailures ?? 0;
        if (moved > 0 && failed === 0) {
          toast.success(`Moved ${moved} file${moved === 1 ? '' : 's'} to the renamed folder.`);
        } else if (failed > 0) {
          toast.error(
            `Renamed the project, but ${failed} file${failed === 1 ? '' : 's'} couldn't be moved. Please contact support.`,
            { duration: 8000 }
          );
        }
        // If moved === 0 and failed === 0, no files exist yet — no toast needed.
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      toast.error('Network error — please try again.');
    } finally {
      setSavingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12">
          <svg className="animate-spin h-12 w-12 text-yellow-400" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toaster lives in the root layout now (single app-wide pipeline). */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-slate-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Client Portal</h1>
              <p className="text-xs text-slate-500">
                {session?.clientName}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* SMS opt-in toggle — shown above the projects grid so existing
            clients see it on their next login without scrolling. */}
        <SmsConsentCard />
        {projects.length === 0 && !showNewProject ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No projects yet</h2>
            <p className="text-slate-500 mb-6">
              Create your first project to start uploading files.
            </p>
            <button
              onClick={() => setShowNewProject(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                  Your Projects
                </h2>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="New Project"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <AnimatePresence>
                {showNewProject && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateProject}
                    className="bg-white rounded-xl border border-yellow-300 p-4 mb-3 overflow-hidden"
                  >
                    <input
                      type="text"
                      placeholder="Project name (e.g., Kitchen Remodel)"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent mb-2"
                      autoFocus
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent mb-3 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!newProjectName.trim() || creatingProject}
                        className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 text-sm font-medium rounded-lg transition-colors"
                      >
                        {creatingProject ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewProject(false);
                          setNewProjectName('');
                          setNewProjectDescription('');
                        }}
                        className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedProject && (
                <motion.div
                  key={selectedProject.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="mb-6">
                    {editingProject ? (
                      <form
                        onSubmit={handleSaveProject}
                        className="bg-white rounded-xl border border-yellow-300 p-4"
                      >
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                          Project name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={120}
                          autoFocus
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent mb-3"
                        />
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                          Description
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          placeholder="Optional"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent mb-3 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={savingProject || !editName.trim()}
                            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 text-sm font-medium rounded-lg transition-colors"
                          >
                            {savingProject ? 'Saving...' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingProject}
                            disabled={savingProject}
                            className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-xl font-semibold text-slate-900 break-words">
                            {selectedProject.name}
                          </h2>
                          {selectedProject.description && (
                            <p className="text-slate-500 mt-1 break-words">
                              {selectedProject.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={startEditingProject}
                          title="Edit project details"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <FileDropzone
                    projectId={selectedProject.id}
                    onUploadStart={handleUploadStart}
                    onUploadProgress={handleUploadProgress}
                    onUploadComplete={handleUploadComplete}
                    onUploadError={handleUploadError}
                    onRetry={registerRetry}
                  />

                  <UploadProgress
                    uploads={uploads}
                    onRemove={handleRemoveUpload}
                    onRetry={handleRetryUpload}
                  />

                  {existingUploads.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
                        Uploaded Files ({existingUploads.length})
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {existingUploads.map((upload) => {
                          const isPreviewable =
                            upload.mimeType.startsWith('image/') &&
                            !NON_PREVIEWABLE_IMAGE_TYPES.has(upload.mimeType) &&
                            !!upload.url;
                          return (
                          <div
                            key={upload.id}
                            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
                          >
                            {isPreviewable ? (
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                <img
                                  src={upload.url!}
                                  alt={upload.fileName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <svg
                                  className="w-6 h-6 text-slate-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {upload.fileName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatBytes(upload.fileSize)}
                                {NON_PREVIEWABLE_IMAGE_TYPES.has(upload.mimeType) && (
                                  <span className="ml-2 text-amber-600">
                                    · Preview not supported in browser
                                  </span>
                                )}
                              </p>
                            </div>
                            {upload.url && (
                              <a
                                href={upload.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showSuccess && (
          <UploadSuccessAnimation
            show={showSuccess}
            onComplete={() => setShowSuccess(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPasswordSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Set Your Password</h3>
                <p className="text-slate-500 text-sm mt-1">
                  Create a password for faster logins next time
                </p>
              </div>

              <form onSubmit={handleSetPassword}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                  />
                </div>

                {passwordError && (
                  <p className="text-red-600 text-sm mb-4">{passwordError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={settingPassword || !newPassword || !confirmPassword}
                    className="flex-1 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-medium rounded-lg transition-colors"
                  >
                    {settingPassword ? 'Setting...' : 'Set Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordSetup(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
