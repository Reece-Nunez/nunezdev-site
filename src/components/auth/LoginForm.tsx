"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function LoginForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(next);
  }

  async function signInMagic(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setMsg("Magic link sent! Check your email.");
  }

  return (
    <form className="space-y-3" onSubmit={signInPassword}>
      <label className="block text-sm">
        <span className="text-gray-700">Email</span>
        <input type="email" className="mt-1 w-full rounded-lg border px-3 py-2"
               value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>

      <label className="block text-sm">
        <span className="text-gray-700">Password</span>
        <input type="password" className="mt-1 w-full rounded-lg border px-3 py-2"
               value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>

      <button type="submit" disabled={loading} className="w-full rounded-lg border px-3 py-2 hover:bg-gray-50">
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">or</span>
        </div>
      </div>

      <button onClick={signInMagic} type="button" disabled={loading || !email}
              className="w-full rounded-lg border px-3 py-2 hover:bg-gray-50">
        {loading ? "Sending..." : "Send magic link"}
      </button>

      {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      {msg && <div className="text-sm text-emerald-700 mt-2">{msg}</div>}
    </form>
  );
}
