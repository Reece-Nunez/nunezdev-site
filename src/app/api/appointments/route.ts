import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calendarService } from '@/lib/calendarService';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const appointmentData = await request.json();

    console.log('Raw appointment data received:', appointmentData);

    const {
      meeting_type,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      client_name,
      client_email,
      client_phone,
      company_name,
      meeting_platform,
      project_details,
      timezone
    } = appointmentData;

    console.log('Parsed appointment data:', {
      meeting_type,
      scheduled_date,
      scheduled_time,
      timezone,
      client_name,
      client_email
    });

    // Validate required fields
    if (!meeting_type || !scheduled_date || !scheduled_time || !client_name || !client_email || !meeting_platform) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Check for conflicting appointments
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('scheduled_date', scheduled_date)
      .eq('scheduled_time', scheduled_time)
      .neq('status', 'cancelled');

    if (existingAppointments && existingAppointments.length > 0) {
      return NextResponse.json(
        { error: 'Time slot is already booked' },
        { status: 409 }
      );
    }

    // Create Google Calendar event
    let googleEventId = null;
    if (calendarService.isAvailable()) {
      try {
        // Create datetime in the specified timezone
        const startDateTime = new Date(`${scheduled_date}T${scheduled_time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + (duration_minutes * 60000));

        console.log('Creating calendar event for:', {
          date: scheduled_date,
          time: scheduled_time,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          timezone
        });

        const event = {
          summary: `${meeting_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${client_name}`,
          description: `Meeting with ${client_name}${company_name ? ` from ${company_name}` : ''}

Platform: ${meeting_platform}
Email: ${client_email}
Phone: ${client_phone || 'Not provided'}

Project Details:
${project_details || 'No details provided'}`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: timezone,
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: timezone,
          },
        };

        console.log('Attempting to create calendar event...');

        const calendarResponse = await calendarService.createEvent(event);

        if (calendarResponse) {
          googleEventId = calendarResponse.id;
          console.log('Calendar event created successfully with ID:', googleEventId);
        }
      } catch (calendarError) {
        console.error('Google Calendar error details:', {
          message: calendarError.message,
          code: calendarError.code,
          errors: calendarError.errors,
          stack: calendarError.stack
        });
        // Continue without calendar integration if it fails
      }
    } else {
      console.log('Google Calendar integration disabled - no credentials configured');
    }

    // Insert appointment into database
    const { data: appointment, error: dbError } = await supabase
      .from('appointments')
      .insert({
        meeting_type,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        client_name,
        client_email,
        client_phone,
        company_name,
        meeting_platform,
        project_details,
        timezone,
        google_calendar_event_id: googleEventId,
        status: 'scheduled'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save appointment' },
        { status: 500 }
      );
    }

    // Send confirmation emails
    try {
      const appointmentDateTime = new Date(`${scheduled_date}T${scheduled_time}:00`);
      const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Send email to client
      await resend.emails.send({
        from: 'Reece at NunezDev <reece@nunezdev.com>',
        to: [client_email],
        subject: `Meeting Confirmed: ${meeting_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #ffc312; margin: 0; font-size: 28px;">Meeting Confirmed!</h1>
                <p style="color: #666; margin: 10px 0 0 0;">Your appointment has been successfully scheduled</p>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">${meeting_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
                <p style="margin: 5px 0; color: #666;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Time:</strong> ${formattedTime} (Central Time)</p>
                <p style="margin: 5px 0; color: #666;"><strong>Duration:</strong> ${duration_minutes} minutes</p>
                <p style="margin: 5px 0; color: #666;"><strong>Platform:</strong> ${meeting_platform.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>

              ${project_details ? `
                <div style="margin: 20px 0;">
                  <h3 style="color: #333; margin: 0 0 10px 0;">Discussion Topics:</h3>
                  <p style="color: #666; margin: 0; background-color: #f8f9fa; padding: 15px; border-radius: 6px;">${project_details}</p>
                </div>
              ` : ''}

              <div style="margin: 30px 0; padding: 20px; background-color: #e8f4f8; border-radius: 6px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">What's Next?</h3>
                <ul style="color: #666; margin: 0; padding-left: 20px;">
                  <li style="margin: 5px 0;">You'll receive a calendar invite shortly</li>
                  <li style="margin: 5px 0;">Meeting details will be included in the invite</li>
                  <li style="margin: 5px 0;">Feel free to reply to this email with any questions</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #666; margin: 0;">Looking forward to our conversation!</p>
                <p style="color: #ffc312; font-weight: bold; margin: 10px 0 0 0;">Reece Nunez</p>
                <p style="color: #999; margin: 5px 0 0 0; font-size: 14px;">NunezDev • reece@nunezdev.com</p>
              </div>
            </div>
          </div>
        `,
      });

      // Send notification email to you
      await resend.emails.send({
        from: 'NunezDev Booking System <reece@nunezdev.com>',
        to: ['reece@nunezdev.com'],
        subject: `New Appointment: ${client_name} - ${meeting_type}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ffc312;">New Appointment Booked</h1>

            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <h2 style="margin: 0 0 15px 0;">${meeting_type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
              <p><strong>Client:</strong> ${client_name}</p>
              <p><strong>Email:</strong> ${client_email}</p>
              <p><strong>Phone:</strong> ${client_phone || 'Not provided'}</p>
              <p><strong>Company:</strong> ${company_name || 'Not provided'}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Platform:</strong> ${meeting_platform}</p>
            </div>

            ${project_details ? `
              <div style="margin: 20px 0;">
                <h3>Project Details:</h3>
                <p style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">${project_details}</p>
              </div>
            ` : ''}

            <p style="margin-top: 20px;">The appointment has been ${googleEventId ? 'added to your Google Calendar successfully' : 'saved to the system (Google Calendar integration is being configured)'}.</p>
          </div>
        `,
      });

      // Update confirmation sent timestamp
      await supabase
        .from('appointments')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', appointment.id);

    } catch (emailError) {
      console.error('Email error:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json(
      {
        success: true,
        appointment,
        message: 'Appointment scheduled successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    );
  }
}