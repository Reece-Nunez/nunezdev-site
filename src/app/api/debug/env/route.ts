import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
      hasStripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasHubspotToken: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN,
      hasResendKey: !!process.env.RESEND_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      awsRegion: process.env.AWS_REGION,
      // Show first few chars of each env var to verify they're actually set
      envVarPrefixes: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10),
        supabaseAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10),
        supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10),
        nextAuthSecret: process.env.NEXTAUTH_SECRET?.substring(0, 6),
        nextAuthUrl: process.env.NEXTAUTH_URL?.substring(0, 15),
        stripeSecret: process.env.STRIPE_SECRET_KEY?.substring(0, 10),
      }
    };

    return NextResponse.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      env: envCheck 
    });
  } catch (error) {
    return NextResponse.json({ 
      status: "error", 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}