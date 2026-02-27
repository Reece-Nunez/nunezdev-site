import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabaseServer } from "@/lib/supabaseServer";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    // No-op provider - Supabase handles actual auth
    Credentials({
      name: "Supabase",
      credentials: {},
      async authorize() {
        return null;
      },
    }),
  ],

  callbacks: {
    async session({ session, token }) {
      try {
        const defaultSession = {
          user: { id: "temp", email: "temp@example.com", name: "Temp User" },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          return defaultSession;
        }

        let supabase;
        try {
          supabase = await supabaseServer();
        } catch (supabaseError) {
          console.error("[NextAuth] Failed to create Supabase client:", supabaseError);
          return defaultSession;
        }

        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error("[NextAuth] Supabase auth error:", error.message);
          return defaultSession;
        }

        if (!user) {
          return defaultSession;
        }

        return {
          user: {
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || user.email || "Unknown",
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

      } catch (error) {
        console.error("[NextAuth] Session callback error:", error instanceof Error ? error.message : String(error));
        return {
          user: { id: "error", email: "error@example.com", name: "Error User" },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
      }
    },

    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },

  events: {
    async signOut() {},
  },
};
