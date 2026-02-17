import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Try to get org memberships if user exists
    let orgData = null;
    let orgError = null;
    if (user) {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id);
      orgData = data;
      orgError = error;
    }
    
    return NextResponse.json({
      session: {
        exists: !!session,
        expires_at: session?.expires_at,
        access_token: session?.access_token ? 'Present' : 'Missing'
      },
      user: {
        id: user?.id,
        email: user?.email,
        error: userError?.message
      },
      org: {
        data: orgData,
        error: orgError?.message
      },
      cookies: {
        // Try to see what cookies are present
        info: 'Check browser dev tools for supabase cookies'
      }
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}