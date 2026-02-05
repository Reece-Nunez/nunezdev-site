'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        google_denied: 'Google sign-in was cancelled',
        invalid_request: 'Invalid request. Please try again.',
        invalid_state: 'Security check failed. Please try again.',
        not_configured: 'Google sign-in is not configured',
        token_failed: 'Failed to authenticate with Google',
        userinfo_failed: 'Failed to get user info from Google',
        no_email: 'Could not get email from Google account',
        not_registered: 'Your Google email is not registered. Please contact us to get access.',
        server_error: 'Server error. Please try again.',
      };
      setError(errorMessages[errorParam] || 'An error occurred');
    }
  }, [searchParams]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/portal/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send magic link');
      }

      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/portal/auth/google';
  };

  if (magicLinkSent) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Check your email
          </h2>
          <p className="text-slate-600">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-slate-500 text-sm mt-4">
            The link expires in 15 minutes
          </p>
          <button
            onClick={() => {
              setMagicLinkSent(false);
              setShowMagicLink(false);
              setEmail('');
            }}
            className="mt-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-yellow-400 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-900"
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
        <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
        <p className="text-slate-600 mt-2">
          Upload files and manage your projects
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {showMagicLink ? (
        <form onSubmit={handleMagicLink}>
          <div className="mb-6">
            <label
              htmlFor="magic-email"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Email address
            </label>
            <input
              type="email"
              id="magic-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>

          <button
            type="button"
            onClick={() => setShowMagicLink(false)}
            className="w-full mt-3 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Back to login
          </button>
        </form>
      ) : (
        <>
          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handlePasswordLogin}>
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all outline-none"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowMagicLink(true)}
            className="w-full mt-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            Sign in with magic link instead
          </button>
        </>
      )}
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </motion.div>

      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </Link>

      <p className="fixed bottom-6 text-center text-slate-400 text-sm w-full">
        NunezDev Client Portal
      </p>
    </div>
  );
}
