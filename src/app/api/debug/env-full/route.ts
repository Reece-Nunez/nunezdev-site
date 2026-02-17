import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Get all environment variables
  const allEnvKeys = Object.keys(process.env).sort();
  
  // Check for specific patterns
  const publicVars = allEnvKeys.filter(key => key.startsWith('NEXT_PUBLIC_'));
  const stripeVars = allEnvKeys.filter(key => key.startsWith('STRIPE_'));
  const supabaseVars = allEnvKeys.filter(key => key.startsWith('SUPABASE_'));
  const nextauthVars = allEnvKeys.filter(key => key.startsWith('NEXTAUTH_'));
  const testVars = allEnvKeys.filter(key => key.startsWith('TEST_'));
  const hubspotVars = allEnvKeys.filter(key => key.startsWith('HUBSPOT_'));
  const resendVars = allEnvKeys.filter(key => key.startsWith('RESEND_'));
  
  // Sample a few env vars we know should exist
  const knownVars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    TEST_SECRET: !!process.env.TEST_SECRET,
  };

  const response = {
    total_env_vars: allEnvKeys.length,
    node_env: process.env.NODE_ENV,
    
    // Pattern counts
    public_vars_count: publicVars.length,
    stripe_vars_count: stripeVars.length,
    supabase_vars_count: supabaseVars.length,
    nextauth_vars_count: nextauthVars.length,
    test_vars_count: testVars.length,
    hubspot_vars_count: hubspotVars.length,
    resend_vars_count: resendVars.length,
    
    // Pattern lists
    public_vars: publicVars,
    stripe_vars: stripeVars,
    supabase_vars: supabaseVars,
    nextauth_vars: nextauthVars,
    test_vars: testVars,
    hubspot_vars: hubspotVars,
    resend_vars: resendVars,
    
    // Known variable checks
    known_vars: knownVars,
    
    // First 50 env var keys for inspection
    first_50_keys: allEnvKeys.slice(0, 50),
    
    // AWS/Amplify specific vars
    aws_vars: allEnvKeys.filter(key => key.startsWith('AWS_')),
    amplify_vars: allEnvKeys.filter(key => key.includes('AMPLIFY')),
    
    // Deployment info
    vercel_vars: allEnvKeys.filter(key => key.startsWith('VERCEL_')),
    
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response);
}