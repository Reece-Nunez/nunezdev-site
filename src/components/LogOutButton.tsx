'use client';

import { signOut } from 'next-auth/react';
import { createClient } from '@/lib/supabaseClient'; // your browser supabase client

export default function LogoutButton() {
  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();               // <— kill Supabase session cookie
    } catch {
      // ignore
    } finally {
      await signOut({ callbackUrl: '/' });         // <— NextAuth signOut + redirect
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 text-gray-800 px-3 py-2 text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
    >
      Logout
    </button>
  );
}
