import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const envVars = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_SECRET_length: process.env.NEXTAUTH_SECRET?.length,
    NEXTAUTH_SECRET_first_10: process.env.NEXTAUTH_SECRET?.substring(0, 10),
    NEXTAUTH_SECRET_exists: !!process.env.NEXTAUTH_SECRET,
    TEST_SECRET: process.env.TEST_SECRET,
    TEST_SECRET_length: process.env.TEST_SECRET?.length,
    TEST_SECRET_first_10: process.env.TEST_SECRET?.substring(0, 10),
    TEST_SECRET_exists: !!process.env.TEST_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    all_nextauth_vars: Object.keys(process.env).filter(key => key.startsWith('NEXTAUTH')),
    all_test_vars: Object.keys(process.env).filter(key => key.startsWith('TEST')),
    all_env_keys_count: Object.keys(process.env).length
  };

  return NextResponse.json(envVars);
}