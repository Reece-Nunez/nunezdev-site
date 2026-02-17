import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Get all booked appointments for the given date
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('scheduled_time, duration_minutes, client_name')
      .eq('scheduled_date', date)
      .neq('status', 'cancelled');

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json(
        { error: 'Failed to check availability' },
        { status: 500 }
      );
    }

    // Define available time slots (9 AM - 5 PM)
    const allTimeSlots = [
      '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'
    ];

    // Check which slots are available
    const availableSlots = allTimeSlots.filter(slot => {
      const isBooked = bookedAppointments?.some(appointment => {
        const appointmentTime = appointment.scheduled_time;
        // Check for exact match or with seconds appended
        return appointmentTime === slot ||
               appointmentTime === `${slot}:00` ||
               appointmentTime.startsWith(`${slot}:`);
      });
      return !isBooked;
    });

    // Convert to 12-hour format for display
    const formatTime = (time24: string) => {
      const [hours, minutes] = time24.split(':');
      const hour12 = parseInt(hours) > 12 ? parseInt(hours) - 12 : parseInt(hours);
      const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
      const displayHour = hour12 === 0 ? 12 : hour12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const timeSlots = allTimeSlots.map(slot => ({
      time: formatTime(slot),
      value: slot,
      available: availableSlots.includes(slot)
    }));

    return NextResponse.json({ timeSlots });

  } catch (error) {
    console.error('Error in availability API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}