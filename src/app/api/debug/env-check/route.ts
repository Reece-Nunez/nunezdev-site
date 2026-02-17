import { NextResponse } from "next/server";

export async function GET() {
  const envCheck = {
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    HUBSPOT_PRIVATE_APP_TOKEN: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_BASE_URL: !!process.env.NEXT_PUBLIC_BASE_URL,
    AWS_REGION: process.env.AWS_REGION,
    NODE_ENV: process.env.NODE_ENV,
    // Show partial values for debugging (first 10 chars)
    STRIPE_SECRET_KEY_PREVIEW: process.env.STRIPE_SECRET_KEY?.substring(0, 10),
    STRIPE_WEBHOOK_SECRET_PREVIEW: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10),
  };

  return NextResponse.json(envCheck);
}