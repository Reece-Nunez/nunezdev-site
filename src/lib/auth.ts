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
  secret: process.env.NEXTAUTH_SECRET,
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
      try {
        console.log("[NextAuth] Session callback called");
        
        // Always return a minimal valid session to prevent 500 errors
        // This is a temporary fix while we debug the Supabase integration
        const defaultSession = { 
          user: { id: "temp", email: "temp@example.com", name: "Temp User" }, 
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        // Check if we have Supabase env vars
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.log("[NextAuth] Missing Supabase env vars - returning default session");
          return defaultSession;
        }

        console.log("[NextAuth] Creating Supabase client...");
        let supabase;
        try {
          supabase = await supabaseServer();
          console.log("[NextAuth] Supabase client created successfully");
        } catch (supabaseError) {
          console.error("[NextAuth] Failed to create Supabase client:", supabaseError);
          return defaultSession;
        }

        console.log("[NextAuth] Getting Supabase user...");
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error("[NextAuth] Supabase auth error:", error.message);
          return defaultSession;
        }
        
        if (!user) {
          console.log("[NextAuth] No Supabase user found");
          return defaultSession;
        }

        console.log("[NextAuth] Found Supabase user:", user.email);
        
        // Update session with Supabase user data
        const updatedSession = {
          user: {
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || user.email || "Unknown",
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        console.log("[NextAuth] Returning updated session");
        return updatedSession;
        
      } catch (error) {
        console.error("[NextAuth] Session callback caught error:", error instanceof Error ? error.message : String(error));
        console.error("[NextAuth] Error stack:", error instanceof Error ? error.stack : "No stack");
        // Always return a valid session object to prevent 500 errors
        return { 
          user: { id: "error", email: "error@example.com", name: "Error User" }, 
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
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
