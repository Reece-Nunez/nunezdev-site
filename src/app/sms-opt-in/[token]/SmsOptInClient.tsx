'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  token: string;
}

export default function SmsOptInClient({ token }: Props) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function confirm() {
    if (status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/sms-opt-in/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to opt in');
      }
      setStatus('done');
      toast.success("You're all set.");
    } catch (err: unknown) {
      setStatus('failed');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {status === 'done' ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You're opted in.</h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              You'll get a text the morning an invoice is due. Reply STOP to any
              message to opt out at any time.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
            >
              Done
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Confirm SMS reminders
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Click the button below to opt in to text reminders for your
              NunezDev invoices.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-gray-700 text-xs leading-relaxed">
                By clicking "Yes, opt me in," you agree to receive transactional
                SMS messages from NunezDev about your invoices, projects, and
                account. Message frequency varies. Message and data rates may
                apply. Reply STOP to opt out at any time, or HELP for help.
                Consent is not a condition of any purchase. See our{' '}
                <a href="/sms-terms" className="text-yellow-600 hover:underline">
                  SMS Terms
                </a>{' '}
                and{' '}
                <a href="/privacy-policy" className="text-yellow-600 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <button
              onClick={confirm}
              disabled={status === 'submitting'}
              className="w-full inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-base px-6 py-3 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'One sec…' : 'Yes, opt me in'}
            </button>

            {status === 'failed' && errorMsg && (
              <p className="text-red-600 text-sm mt-4">{errorMsg}</p>
            )}

            <p className="text-gray-400 text-xs mt-6 text-center">
              Don't want this? Just close this page — nothing changes.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
