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
  
  pages: {
    signIn: '/login',
    error: '/login',
  },

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
    // Session callback that reads from Supabase
    async session({ session, token }) {
      console.log("[NextAuth] Session callback called");
      
      try {
        // Check if we have Supabase env vars
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.log("[NextAuth] Missing Supabase env vars");
          return session;
        }

        const supabase = await supabaseServer();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          console.log("[NextAuth] No Supabase user found:", error?.message);
          return { ...session, user: undefined };
        }

        console.log("[NextAuth] Found Supabase user:", user.email);
        
        // Update session with Supabase user data
        return {
          ...session,
          user: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
          }
        };
        
      } catch (error) {
        console.error("[NextAuth] Session callback error:", error);
        return session;
      }
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
