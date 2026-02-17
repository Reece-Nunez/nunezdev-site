import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data: meetingTypes, error } = await supabase
      .from('meeting_types')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) {
      console.error('Error fetching meeting types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch meeting types' },
        { status: 500 }
      );
    }

    return NextResponse.json(meetingTypes);
  } catch (error) {
    console.error('Error in meeting-types API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}