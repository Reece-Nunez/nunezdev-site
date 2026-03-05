'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { SectionStatus, ChecklistItem, ReportSection, PerformanceMetrics, AnalyticsMetrics } from '@/lib/pdf-templates/client-report';
import type { AutomationResult } from '@/lib/report-automation/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

interface SectionConfig {
  key: string;
  title: string;
  items: string[];
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'siteHealth',
    title: 'Site Health & Uptime',
    items: [
      'Verified site is live and loading correctly',
      'Checked all pages load without errors',
      'Tested on mobile (iPhone + Android)',
      'Tested on desktop (Chrome, Firefox, Edge)',
      'Checked SSL certificate is valid',
    ],
  },
  {
    key: 'performance',
    title: 'Performance',
    items: [
      'Ran Google Lighthouse audit (Desktop + Mobile)',
      'Checked Core Web Vitals (LCP, CLS, INP)',
      'Verified images are optimized',
      'Checked page load times across key pages',
    ],
  },
  {
    key: 'security',
    title: 'Security & Dependencies',
    items: [
      'Ran npm audit for vulnerabilities',
      'Updated dependencies if patches available',
      'Reviewed framework for security advisories',
      'Verified spam protection is functioning on forms',
      'Checked for exposed environment variables',
    ],
  },
  {
    key: 'seo',
    title: 'SEO & Discoverability',
    items: [
      'Checked Google Search Console for indexing issues',
      'Verified sitemap is accessible and up to date',
      'Checked for broken links (internal + external)',
      'Reviewed meta titles and descriptions',
      'Verified Open Graph tags for social sharing',
    ],
  },
  {
    key: 'forms',
    title: 'Forms & Lead Generation',
    items: [
      'Submitted test inquiry through contact form',
      'Verified email delivery',
      'Checked spam filter is working correctly',
      'Reviewed form submission errors in logs',
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics Overview',
    items: [
      'Reviewed traffic for the month',
      'Identified top-performing pages',
      'Noted any traffic trends or anomalies',
    ],
  },
  {
    key: 'content',
    title: 'Content & Gallery',
    items: [
      'Verified all portfolio/gallery images are loading',
      'Checked for outdated content or placeholder text',
      'Asked client if new projects need to be added',
    ],
  },
  {
    key: 'hosting',
    title: 'Hosting & Infrastructure',
    items: [
      'Verified builds are deploying successfully',
      'Checked build logs for warnings or errors',
      'Reviewed hosting configuration for issues',
      'Confirmed domain and DNS settings are correct',
    ],
  },
];

const STATUS_OPTIONS: { value: SectionStatus; label: string; color: string }[] = [
  { value: 'healthy', label: 'Healthy', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'attention', label: 'Attention', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'issue', label: 'Issue', color: 'text-red-600 bg-red-50 border-red-200' },
];

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
    });
  }
  return options;
}

interface Props {
  onReportSaved: () => void;
}

export default function ReportBuilder({ onReportSaved }: Props) {
  const { data: clientsData } = useSWR<{ clients: Client[] }>('/api/clients', fetcher);
  const clients = clientsData?.clients || [];

  const [clientId, setClientId] = useState('');
  const [reportMonth, setReportMonth] = useState(getMonthOptions()[1]?.value || getMonthOptions()[0]?.value); // default to last month

  // Section states
  const [sectionStates, setSectionStates] = useState<Record<string, { items: boolean[]; notes: string; status: SectionStatus }>>(() => {
    const initial: Record<string, { items: boolean[]; notes: string; status: SectionStatus }> = {};
    SECTIONS.forEach(s => {
      initial[s.key] = {
        items: s.items.map(() => false),
        notes: '',
        status: 'healthy',
      };
    });
    return initial;
  });

  // Performance metrics
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    desktop: { score: '', lcp: '', cls: '', inp: '' },
    mobile: { score: '', lcp: '', cls: '', inp: '' },
  });

  // Analytics metrics
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics>({
    totalVisitors: '',
    topPage: '',
    formSubmissions: '',
    bounceRate: '',
  });

  // Recommendations
  const [recommendations, setRecommendations] = useState(['', '', '']);

  // Overall
  const [overallStatus, setOverallStatus] = useState('Excellent');
  const [hoursSpent, setHoursSpent] = useState('');

  // Loading states
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleItem = useCallback((sectionKey: string, idx: number) => {
    setSectionStates(prev => {
      const section = prev[sectionKey];
      const newItems = [...section.items];
      newItems[idx] = !newItems[idx];
      return { ...prev, [sectionKey]: { ...section, items: newItems } };
    });
  }, []);

  const updateNotes = useCallback((sectionKey: string, notes: string) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], notes },
    }));
  }, []);

  const updateStatus = useCallback((sectionKey: string, status: SectionStatus) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], status },
    }));
  }, []);

  const applyAutomationResults = useCallback((result: AutomationResult) => {
    const sectionKeys = ['siteHealth', 'performance', 'security', 'seo', 'forms', 'analytics', 'content', 'hosting'] as const;

    setSectionStates(prev => {
      const next = { ...prev };
      for (const key of sectionKeys) {
        const sectionResult = result[key];
        if (sectionResult && next[key]) {
          next[key] = {
            items: sectionResult.items,
            notes: sectionResult.notes || prev[key].notes,
            status: sectionResult.status || prev[key].status,
          };
        }
      }
      return next;
    });

    if (result.performance?.perfMetrics) {
      setPerfMetrics(result.performance.perfMetrics);
    }

    if (result.analytics?.analyticsMetrics) {
      setAnalyticsMetrics(result.analytics.analyticsMetrics);
    }

    if (result.overallStatus) {
      setOverallStatus(result.overallStatus);
    }

    if (result.recommendations?.length) {
      const recs = [...result.recommendations];
      while (recs.length < 3) recs.push('');
      setRecommendations(recs.slice(0, 3));
    }
  }, []);

  const handleAutoFill = async () => {
    if (!clientId) {
      setMessage({ type: 'error', text: 'Please select a client first' });
      return;
    }
    setAutomating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/client-reports/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, report_month: reportMonth }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Automation failed');
      }
      const result: AutomationResult = await res.json();
      applyAutomationResults(result);
      setMessage({ type: 'success', text: 'Report auto-filled! Review and adjust as needed.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Automation failed' });
    } finally {
      setAutomating(false);
    }
  };

  const buildReportData = () => {
    const sections: Record<string, ReportSection & { metrics?: PerformanceMetrics | AnalyticsMetrics }> = {};
    SECTIONS.forEach(config => {
      const state = sectionStates[config.key];
      const base: ReportSection = {
        items: config.items.map((label, i): ChecklistItem => ({
          label,
          checked: state.items[i],
        })),
        notes: state.notes,
        status: state.status,
      };

      if (config.key === 'performance') {
        (base as ReportSection & { metrics: PerformanceMetrics }).metrics = perfMetrics;
      }
      if (config.key === 'analytics') {
        (base as ReportSection & { metrics: AnalyticsMetrics }).metrics = analyticsMetrics;
      }

      sections[config.key] = base;
    });

    return {
      sections,
      recommendations,
      overallStatus,
      hoursSpent,
    };
  };

  const handleSave = async () => {
    if (!clientId) {
      setMessage({ type: 'error', text: 'Please select a client' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/client-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          report_month: reportMonth,
          report_data: buildReportData(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save report');
      }

      const data = await res.json();
      setSavedReportId(data.id);
      setMessage({ type: 'success', text: 'Report saved successfully!' });
      onReportSaved();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!savedReportId) {
      setMessage({ type: 'error', text: 'Please save the report first' });
      return;
    }

    setDownloading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-reports/${savedReportId}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const client = clients.find(c => c.id === clientId);
      const monthLabel = getMonthOptions().find(m => m.value === reportMonth)?.label || reportMonth;
      a.download = `${(client?.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_Report_${monthLabel.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage({ type: 'success', text: 'PDF downloaded!' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to download PDF' });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!savedReportId) {
      setMessage({ type: 'error', text: 'Please save the report first' });
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (!client?.email) {
      setMessage({ type: 'error', text: 'Client has no email address' });
      return;
    }

    if (!confirm(`Send the report to ${client.email}?`)) return;

    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/client-reports/${savedReportId}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send');
      }

      setMessage({ type: 'success', text: `Report sent to ${client.email}!` });
      onReportSaved();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Client & Month Selection */}
      <div className="rounded-2xl border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Client</label>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setSavedReportId(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>
            {selectedClient?.email && (
              <p className="text-xs text-gray-500 mt-1">Report will be sent to: {selectedClient.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Report Month</label>
            <select
              value={reportMonth}
              onChange={e => { setReportMonth(e.target.value); setSavedReportId(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {getMonthOptions().map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Hours Spent</label>
            <input
              type="text"
              value={hoursSpent}
              onChange={e => setHoursSpent(e.target.value)}
              placeholder="e.g. 4.5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-gray-600 mb-1">Overall Site Health</label>
          <div className="flex gap-2">
            {['Excellent', 'Good', 'Needs Attention'].map(opt => (
              <button
                key={opt}
                onClick={() => setOverallStatus(opt)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  overallStatus === opt
                    ? opt === 'Excellent'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : opt === 'Good'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleAutoFill}
            disabled={automating || !clientId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {automating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running Automated Checks...
              </>
            ) : (
              'Auto-Fill Report'
            )}
          </button>
          <p className="text-xs text-gray-500 mt-1 text-center">
            Runs site health, performance, SEO, analytics, and hosting checks automatically
          </p>
        </div>
      </div>

      {/* Checklist Sections */}
      {SECTIONS.map(config => {
        const state = sectionStates[config.key];
        const checkedCount = state.items.filter(Boolean).length;

        return (
          <div key={config.key} className="rounded-2xl border bg-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {checkedCount}/{config.items.length}
                </span>
              </div>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateStatus(config.key, opt.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      state.status === opt.value ? opt.color : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {config.items.map((label, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={state.items[idx]}
                    onChange={() => toggleItem(config.key, idx)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className={`text-sm ${state.items[idx] ? 'text-gray-900' : 'text-gray-600'}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Performance Metrics */}
            {config.key === 'performance' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Lighthouse Scores</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Desktop</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['score', 'lcp', 'cls', 'inp'] as const).map(metric => (
                        <div key={metric}>
                          <label className="text-xs text-gray-500 capitalize">{metric === 'score' ? 'Score' : metric.toUpperCase()}</label>
                          <input
                            type="text"
                            value={perfMetrics.desktop[metric]}
                            onChange={e => setPerfMetrics(prev => ({
                              ...prev,
                              desktop: { ...prev.desktop, [metric]: e.target.value },
                            }))}
                            placeholder="-"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Mobile</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['score', 'lcp', 'cls', 'inp'] as const).map(metric => (
                        <div key={metric}>
                          <label className="text-xs text-gray-500 capitalize">{metric === 'score' ? 'Score' : metric.toUpperCase()}</label>
                          <input
                            type="text"
                            value={perfMetrics.mobile[metric]}
                            onChange={e => setPerfMetrics(prev => ({
                              ...prev,
                              mobile: { ...prev.mobile, [metric]: e.target.value },
                            }))}
                            placeholder="-"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Metrics */}
            {config.key === 'analytics' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Traffic Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Total Visitors</label>
                    <input
                      type="text"
                      value={analyticsMetrics.totalVisitors}
                      onChange={e => setAnalyticsMetrics(prev => ({ ...prev, totalVisitors: e.target.value }))}
                      placeholder="-"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Top Page</label>
                    <input
                      type="text"
                      value={analyticsMetrics.topPage}
                      onChange={e => setAnalyticsMetrics(prev => ({ ...prev, topPage: e.target.value }))}
                      placeholder="-"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Form Submissions</label>
                    <input
                      type="text"
                      value={analyticsMetrics.formSubmissions}
                      onChange={e => setAnalyticsMetrics(prev => ({ ...prev, formSubmissions: e.target.value }))}
                      placeholder="-"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Bounce Rate</label>
                    <input
                      type="text"
                      value={analyticsMetrics.bounceRate}
                      onChange={e => setAnalyticsMetrics(prev => ({ ...prev, bounceRate: e.target.value }))}
                      placeholder="-"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500">Notes</label>
              <textarea
                value={state.notes}
                onChange={e => updateNotes(config.key, e.target.value)}
                placeholder="Any issues, actions taken, or observations..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        );
      })}

      {/* Recommendations */}
      <div className="rounded-2xl border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations & Next Steps</h2>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold shrink-0 mt-1">
                {i + 1}
              </span>
              <textarea
                value={rec}
                onChange={e => {
                  const updated = [...recommendations];
                  updated[i] = e.target.value;
                  setRecommendations(updated);
                }}
                placeholder={`Recommendation ${i + 1}...`}
                rows={2}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-2xl border bg-white p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !clientId}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-3 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : savedReportId ? 'Update Report' : 'Save Report'}
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={downloading || !savedReportId}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 text-gray-700 px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>

          <button
            onClick={handleSendEmail}
            disabled={sending || !savedReportId || !selectedClient?.email}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending...' : 'Send to Client'}
          </button>
        </div>
        {!savedReportId && clientId && (
          <p className="text-xs text-gray-500 mt-2 text-center">Save the report first to enable PDF download and email sending</p>
        )}
      </div>
    </div>
  );
}
