import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    console.log('Testing Supabase connection...');
    
    const supabase = await supabaseServer();
    
    // Test 1: Check if we can create the client
    console.log('Supabase client created successfully');
    
    // Test 2: Try to get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check result:', { user: user?.id, authError });
    
    // Test 3: Try a simple database query
    const { data: testData, error: dbError } = await supabase
      .from('clients')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    console.log('Database test result:', { testData, dbError });
    
    return NextResponse.json({
      success: true,
      results: {
        client: 'Created successfully',
        auth: {
          user: user?.id || 'No user',
          error: authError?.message || null
        },
        database: {
          error: dbError?.message || null,
          success: !dbError
        }
      }
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Connection test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: message,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}