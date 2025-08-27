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
    // Put Supabase user/org on the NextAuth session so useSession() works
    async session({ session }) {
      try {
        const supabase = await supabaseServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // basic fields
          interface SessionUser {
            id: string;
            email?: string;
            name?: string | null;
            image?: string | null;
          }
          type CustomSession = {
            user?: SessionUser;
            orgId: string | null;
            role: string | null;
            [key: string]: unknown;
          };
          session.user = {
            ...session.user,
            id: user.id,
            email: user.email ?? undefined,
          } as SessionUser;

          // attach latest org (if any)
          const { data: m } = await supabase
            .from("org_members")
            .select("org_id, role, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          ((session as unknown) as CustomSession).orgId = m?.[0]?.org_id ?? null;
          ((session as unknown) as CustomSession).role = m?.[0]?.role ?? null;
        } else {
          session.user = undefined as unknown as typeof session.user;
        }
      } catch {
        // ignore — keep session minimal
      }
      return session;
    },

    // Keep JWT as-is; we rely on Supabase each request
    async jwt({ token }) {
      return token;
    },
  },

  events: {
    // Best-effort: when NextAuth signs out, also clear Supabase auth cookies
    async signOut() {
      try {
        const supabase = await supabaseServer();
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    },
  },
};
