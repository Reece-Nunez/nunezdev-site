'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TimeEntry {
  id: string;
  description: string;
  duration_minutes: number;
  entry_date: string;
  billable: boolean;
  hourly_rate_cents?: number;
  amount_cents?: number;
  status: 'running' | 'logged' | 'billed';
  project?: string;
  started_at?: string;
  clients?: { id: string; name?: string; company?: string } | null;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

const formatDuration = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
};

const formatCurrency = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function TimeTrackingPage() {
  const { data: entriesData, mutate: mutateEntries } = useSWR<{ entries: TimeEntry[] }>('/api/time-entries?limit=50', fetcher);
  const { data: runningData, mutate: mutateRunning } = useSWR<{ entry: TimeEntry | null }>('/api/time-entries/running', fetcher, { refreshInterval: 1000 });
  const { data: clientsData } = useSWR<{ clients: Client[] }>('/api/clients', fetcher);
  const { showToast, ToastContainer } = useToast();

  const entries = entriesData?.entries ?? [];
  const runningEntry = runningData?.entry;
  const clients = clientsData?.clients ?? [];

  // Timer display state
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  // Form state
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [project, setProject] = useState('');
  const [billable, setBillable] = useState(true);
  const [manualMinutes, setManualMinutes] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('75');

  // Generate invoice state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  // Update timer display
  useEffect(() => {
    if (!runningEntry?.started_at) {
      setTimerDisplay('00:00:00');
      return;
    }

    const updateTimer = () => {
      const started = new Date(runningEntry.started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - started) / 1000);
      const hrs = Math.floor(elapsed / 3600);
      const mins = Math.floor((elapsed % 3600) / 60);
      const secs = elapsed % 60;
      setTimerDisplay(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [runningEntry?.started_at]);

  const startTimer = async () => {
    if (!description.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }

    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          client_id: clientId || null,
          project: project || null,
          billable,
          hourly_rate_cents: billable ? Math.round(parseFloat(hourlyRate) * 100) : null,
          start_timer: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setDescription('');
      mutateRunning();
      mutateEntries();
      showToast('Timer started', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start timer', 'error');
    }
  };

  const stopTimer = async () => {
    if (!runningEntry) return;

    try {
      const res = await fetch(`/api/time-entries/${runningEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_timer: true })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      mutateRunning();
      mutateEntries();
      showToast('Timer stopped', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to stop timer', 'error');
    }
  };

  const addManualEntry = async () => {
    if (!description.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }

    const minutes = parseInt(manualMinutes);
    if (isNaN(minutes) || minutes <= 0) {
      showToast('Please enter valid duration in minutes', 'error');
      return;
    }

    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          client_id: clientId || null,
          project: project || null,
          billable,
          hourly_rate_cents: billable ? Math.round(parseFloat(hourlyRate) * 100) : null,
          duration_minutes: minutes
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setDescription('');
      setManualMinutes('');
      setShowManualEntry(false);
      mutateEntries();
      showToast('Time entry added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add entry', 'error');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this time entry?')) return;

    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      mutateEntries();
      showToast('Entry deleted', 'success');
    } catch {
      showToast('Failed to delete entry', 'error');
    }
  };

  const toggleEntrySelection = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateInvoice = async () => {
    if (selectedEntries.size === 0) {
      showToast('Select time entries to invoice', 'error');
      return;
    }

    // Find client from selected entries
    const selectedEntry = entries.find(e => selectedEntries.has(e.id));
    if (!selectedEntry?.clients?.id) {
      showToast('Selected entries must have a client assigned', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/time-entries/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_ids: Array.from(selectedEntries),
          client_id: selectedEntry.clients.id,
          hourly_rate_cents: Math.round(parseFloat(hourlyRate) * 100)
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSelectedEntries(new Set());
      mutateEntries();
      showToast(`Invoice ${result.invoice_number} created for ${result.total_hours} hours`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate invoice', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Stats
  const todayMinutes = entries
    .filter(e => e.entry_date === new Date().toISOString().split('T')[0])
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  const unbilledEntries = entries.filter(e => e.status === 'logged' && e.billable);
  const unbilledMinutes = unbilledEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const unbilledAmount = unbilledEntries.reduce((sum, e) => sum + (e.amount_cents || 0), 0);

  return (
    <>
      <ToastContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-full">
        <h1 className="text-xl sm:text-2xl font-semibold">Time Tracking</h1>

        {/* Timer Card */}
        <div className="bg-white rounded-xl border p-4 sm:p-6">
          {/* Timer Display */}
          <div className="text-center mb-6">
            <div className={`text-5xl sm:text-6xl font-mono font-bold ${runningEntry ? 'text-emerald-600' : 'text-gray-400'}`}>
              {timerDisplay}
            </div>
            {runningEntry && (
              <div className="mt-2 text-sm text-gray-600">
                {runningEntry.description}
                {runningEntry.clients?.name && <span className="text-gray-400"> - {runningEntry.clients.name}</span>}
              </div>
            )}
          </div>

          {/* Input Fields */}
          {!runningEntry && (
            <div className="space-y-3 mb-4">
              <input
                type="text"
                className="w-full rounded-lg border px-4 py-3 text-lg"
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !showManualEntry && startTimer()}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">$</span>
                  <input
                    type="number"
                    className="w-20 rounded-lg border px-2 py-2 text-sm"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                  <span className="text-sm text-gray-600">/hr</span>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                    className="rounded"
                  />
                  Billable
                </label>
              </div>

              {showManualEntry && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    className="w-32 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Minutes"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value)}
                  />
                  <button
                    onClick={addManualEntry}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
                  >
                    Add Entry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timer Buttons */}
          <div className="flex items-center justify-center gap-4">
            {runningEntry ? (
              <button
                onClick={stopTimer}
                className="px-8 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 text-lg"
              >
                Stop
              </button>
            ) : (
              <>
                <button
                  onClick={startTimer}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 text-lg"
                >
                  Start Timer
                </button>
                <button
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="px-4 py-3 text-gray-600 hover:text-gray-800 text-sm"
                >
                  {showManualEntry ? 'Cancel' : '+ Manual Entry'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Today</div>
            <div className="text-lg font-semibold">{formatDuration(todayMinutes)}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Unbilled Time</div>
            <div className="text-lg font-semibold">{formatDuration(unbilledMinutes)}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Unbilled Amount</div>
            <div className="text-lg font-semibold text-emerald-600">{formatCurrency(unbilledAmount)}</div>
          </div>
          <div className="bg-white rounded-xl border p-3">
            <div className="text-xs text-gray-500">Entries Selected</div>
            <div className="text-lg font-semibold">{selectedEntries.size}</div>
          </div>
        </div>

        {/* Generate Invoice Button */}
        {selectedEntries.size > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-emerald-700">
              {selectedEntries.size} entries selected
            </span>
            <button
              onClick={generateInvoice}
              disabled={generating}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        )}

        {/* Time Entries List */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent Time Entries</h2>
          </div>

          {entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No time entries yet. Start tracking your time!
            </div>
          ) : (
            <div className="divide-y">
              {entries.map(entry => (
                <div key={entry.id} className={`p-4 hover:bg-gray-50 ${entry.status === 'billed' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    {entry.status === 'logged' && entry.billable && (
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={() => toggleEntrySelection(entry.id)}
                        className="mt-1 rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.description}</span>
                        {entry.project && (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{entry.project}</span>
                        )}
                        {!entry.billable && (
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Non-billable</span>
                        )}
                        {entry.status === 'billed' && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Billed</span>
                        )}
                        {entry.status === 'running' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded animate-pulse">Running</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {entry.clients?.name || 'No client'}
                        <span className="mx-2">·</span>
                        {new Date(entry.entry_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-medium">{formatDuration(entry.duration_minutes)}</div>
                      {entry.billable && entry.amount_cents !== undefined && entry.amount_cents > 0 && (
                        <div className="text-sm text-emerald-600">{formatCurrency(entry.amount_cents)}</div>
                      )}
                    </div>
                    {entry.status !== 'billed' && (
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
