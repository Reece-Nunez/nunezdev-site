import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const logs: string[] = [];
  
  // Capture console logs
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    logs.push(`LOG: ${args.join(' ')}`);
    originalLog(...args);
  };
  
  console.error = (...args) => {
    logs.push(`ERROR: ${args.join(' ')}`);
    originalError(...args);
  };
  
  try {
    logs.push("Starting getServerSession test...");
    const session = await getServerSession(authOptions);
    logs.push(`Session result: ${JSON.stringify(session)}`);
    
    return NextResponse.json({ 
      status: "success",
      session: session,
      logs: logs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logs.push(`CATCH ERROR: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logs.push(`STACK: ${error.stack}`);
    }
    
    return NextResponse.json({ 
      status: "error", 
      error: error instanceof Error ? error.message : String(error),
      logs: logs,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    // Restore original console methods
    console.log = originalLog;
    console.error = originalError;
  }
}