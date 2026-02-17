import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !anon) {
      return NextResponse.json({ 
        status: "error", 
        error: "Missing Supabase environment variables",
        hasUrl: !!url,
        hasAnon: !!anon
      }, { status: 500 });
    }

    const supabase = createClient(url, anon);
    
    // Test basic connection
    const { data, error } = await supabase
      .from('org_members')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json({ 
        status: "supabase_error", 
        error: error.message,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({ 
      status: "ok", 
      message: "Supabase connection successful",
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