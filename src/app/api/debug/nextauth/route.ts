import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try to get session without the custom callback
    const session = await getServerSession({
      ...authOptions,
      callbacks: {
        // Minimal callbacks to avoid Supabase issues
        async jwt({ token }) {
          return token;
        },
        async session({ session }) {
          return session;
        },
      }
    });

    return NextResponse.json({ 
      status: "ok", 
      hasSession: !!session,
      sessionUser: session?.user ? "present" : "none",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      status: "error", 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}