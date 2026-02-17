'use client';

import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import {
  XMarkIcon,
  VideoCameraIcon,
  MapPinIcon,
  ClockIcon,
  UserIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  url?: string;
  extendedProps?: {
    status?: string;
    hangoutLink?: string;
    description?: string;
    location?: string;
    attendees?: string[];
  };
}

interface NewEventForm {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  attendees: string;
  createMeet: boolean;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventForm, setNewEventForm] = useState<NewEventForm>({
    title: '',
    description: '',
    start: '',
    end: '',
    location: '',
    attendees: '',
    createMeet: false,
  });
  const [creating, setCreating] = useState(false);
  const calendarRef = useRef<any>(null);

  // Initial fetch happens via datesSet callback when calendar first renders
  // Don't fetch without dates as Google Calendar API requires timeMin with orderBy: startTime

  // Debug: log when events change
  useEffect(() => {
    console.log('[Calendar UI] Events state updated:', events.length, 'events', events);
  }, [events]);

  async function fetchEvents(start?: Date, end?: Date) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start.toISOString());
      if (end) params.set('end', end.toISOString());

      const res = await fetch(`/api/google/calendar/events?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }

      console.log('[Calendar UI] Received events from API:', data.events?.length, data.events?.slice(0, 3));
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDateRangeChange(info: any) {
    console.log('[Calendar UI] Date range changed:', info.start?.toISOString(), '-', info.end?.toISOString());
    fetchEvents(info.start, info.end);
  }

  function handleEventClick(info: any) {
    info.jsEvent.preventDefault();
    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      start: info.event.start?.toISOString() || '',
      end: info.event.end?.toISOString() || '',
      allDay: info.event.allDay,
      url: info.event.url,
      extendedProps: info.event.extendedProps,
    });
  }

  function handleDateSelect(info: any) {
    const startDate = info.start;
    const endDate = info.end || new Date(startDate.getTime() + 60 * 60 * 1000);

    setNewEventForm({
      title: '',
      description: '',
      start: formatDateTimeLocal(startDate),
      end: formatDateTimeLocal(endDate),
      location: '',
      attendees: '',
      createMeet: false,
    });
    setShowNewEventModal(true);
  }

  function formatDateTimeLocal(date: Date): string {
    const offset = date.getTimezoneOffset();
    const adjusted = new Date(date.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().slice(0, 16);
  }

  function formatEventTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/google/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventForm.title,
          description: newEventForm.description,
          start: new Date(newEventForm.start).toISOString(),
          end: new Date(newEventForm.end).toISOString(),
          location: newEventForm.location,
          attendees: newEventForm.attendees
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean),
          createMeet: newEventForm.createMeet,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      setShowNewEventModal(false);
      setNewEventForm({
        title: '',
        description: '',
        start: '',
        end: '',
        location: '',
        attendees: '',
        createMeet: false,
      });

      // Refresh calendar
      if (calendarRef.current) {
        const api = calendarRef.current.getApi();
        fetchEvents(api.view.activeStart, api.view.activeEnd);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <button
          onClick={() => {
            const now = new Date();
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            setNewEventForm({
              title: '',
              description: '',
              start: formatDateTimeLocal(now),
              end: formatDateTimeLocal(end),
              location: '',
              attendees: '',
              createMeet: false,
            });
            setShowNewEventModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <PlusIcon className="w-5 h-5" />
          New Event
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          events={events}
          eventClick={handleEventClick}
          select={handleDateSelect}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={5}
          weekends={true}
          datesSet={handleDateRangeChange}
          loading={(isLoading) => setLoading(isLoading)}
          height={800}
          contentHeight={750}
          eventClassNames="cursor-pointer"
          eventColor="#10b981"
        />
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-gray-600">
                <ClockIcon className="w-5 h-5" />
                <div>
                  <div>{formatEventTime(selectedEvent.start)}</div>
                  {selectedEvent.end && (
                    <div className="text-sm text-gray-500">
                      to {formatEventTime(selectedEvent.end)}
                    </div>
                  )}
                </div>
              </div>

              {selectedEvent.extendedProps?.hangoutLink && (
                <div className="flex items-center gap-3">
                  <VideoCameraIcon className="w-5 h-5 text-blue-600" />
                  <a
                    href={selectedEvent.extendedProps.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Join Google Meet
                  </a>
                </div>
              )}

              {selectedEvent.extendedProps?.location && (
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPinIcon className="w-5 h-5" />
                  <span>{selectedEvent.extendedProps.location}</span>
                </div>
              )}

              {selectedEvent.url && (
                <a
                  href={selectedEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 text-center py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Open in Google Calendar
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">New Event</h3>
              <button
                onClick={() => setShowNewEventModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={newEventForm.title}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Meeting title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newEventForm.start}
                    onChange={(e) =>
                      setNewEventForm({ ...newEventForm, start: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newEventForm.end}
                    onChange={(e) =>
                      setNewEventForm({ ...newEventForm, end: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newEventForm.description}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Event description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={newEventForm.location}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, location: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Meeting location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attendees (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={newEventForm.attendees}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, attendees: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createMeet"
                  checked={newEventForm.createMeet}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, createMeet: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="createMeet" className="text-sm text-gray-700">
                  Add Google Meet video conferencing
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
