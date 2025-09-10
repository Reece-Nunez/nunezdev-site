import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    const response = await fetch(`${baseUrl}/api/recurring-invoices/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to process recurring invoices:', error);
      return NextResponse.json({ 
        error: 'Failed to process recurring invoices',
        details: error 
      }, { status: 500 });
    }

    const result = await response.json();
    
    console.log(`Automated recurring invoice processing completed: ${result.processed} invoices processed`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} recurring invoices`,
      timestamp: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Error in automated recurring invoice processing:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}