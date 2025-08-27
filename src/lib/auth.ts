// lib/auth.ts (or add below your requireOwner in the same file)

import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * NextAuth is used here mainly to provide /api/auth/* endpoints
 * (so signOut works). We read the real user from Supabase in callbacks
 * and DO NOT handle sign-in in NextAuth (authorize returns null).
 */
export const authOptions: NextAuthOptions = {
  // Do not change basePath unless you also update client calls.
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Supabase",
      credentials: {},
      // We’re not using NextAuth for sign-in. Supabase handles auth.
      // Returning null keeps this a no-op provider.
      async authorize() {
        return null;
      },
    }),
  ],

  callbacks: {
    // Simplified session callback - no Supabase integration for now
    async session({ session, token }) {
      console.log("[NextAuth] Session callback called with:", { hasSession: !!session, hasToken: !!token });
      
      // Just return the basic session for now
      if (session?.user) {
        // Add any token data to session if needed
        if (token?.sub) {
          (session.user as any).id = token.sub;
        }
      }
      
      console.log("[NextAuth] Returning session:", { hasUser: !!session?.user });
      return session;
    },

    // Basic JWT callback
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },

  events: {
    // Simplified signOut - no Supabase integration for now
    async signOut() {
      console.log("[NextAuth] Sign out event");
    },
  },
};
