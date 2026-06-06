'use client';

/**
 * Inline opt-in card shown on the portal dashboard.
 *
 * - Fetches current consent state on mount; toggle defers until we know.
 * - Full CTIA disclosure rendered inline so the act of checking the
 *   box constitutes documented consent.
 * - If the client has no phone on file, shows a hint instead of the
 *   toggle (the toggle is meaningless without a number).
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface ConsentState {
  consent: boolean;
  consentedAt: string | null;
  optedOutAt: string | null;
  hasPhone: boolean;
  phoneLast4: string | null;
}

export default function SmsConsentCard() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/portal/sms-consent')
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: ConsentState) => setState(data))
      .catch(() => toast.error('Could not load SMS settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleConsent(next: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/portal/sms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: next }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await fetch('/api/portal/sms-consent').then(r => r.json());
      setState(updated);
      toast.success(
        next
          ? "You're opted in. We'll text you when an invoice is due."
          : 'You have opted out of SMS reminders.',
      );
    } catch {
      toast.error('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 mb-6">
        Loading SMS settings…
      </div>
    );
  }
  if (!state) return null;

  const isOptedIn = state.consent && !state.optedOutAt;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-slate-900 font-semibold text-sm">SMS payment reminders</h3>
          <p className="text-slate-500 text-xs mt-1">
            Get a text the morning an invoice is due.
            {state.phoneLast4 && (
              <> Sent to the phone number ending in <strong>{state.phoneLast4}</strong>.</>
            )}
          </p>
        </div>
        {state.hasPhone ? (
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isOptedIn}
              disabled={saving}
              onChange={e => toggleConsent(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-400/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400" />
          </label>
        ) : (
          <span className="text-amber-600 text-xs whitespace-nowrap">
            Add a phone to enable
          </span>
        )}
      </div>

      {/* CTIA disclosure — the user's act of checking the toggle above
          constitutes consent to this language. */}
      <p className="text-slate-400 text-[11px] leading-relaxed">
        By enabling this, you agree to receive transactional SMS messages
        from NunezDev about your invoices, projects, and account.
        Message frequency varies. Message and data rates may apply.
        Reply STOP to opt out at any time, or HELP for help. Consent is
        not a condition of any purchase. See our{' '}
        <a href="/sms-terms" target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">
          SMS Terms
        </a>{' '}
        and{' '}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">
          Privacy Policy
        </a>
        .
      </p>

      {state.optedOutAt && state.consent && (
        <p className="mt-3 text-amber-600 text-xs">
          You opted out on {new Date(state.optedOutAt).toLocaleDateString()}. Flip the toggle back on to re-subscribe.
        </p>
      )}
    </div>
  );
}
