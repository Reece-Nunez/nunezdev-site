"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ClockIcon, CalendarDaysIcon, VideoCameraIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "./Toast";

interface TimeSlot {
  time: string;
  value: string;
  available: boolean;
}

interface MeetingType {
  id: string;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  color: string;
}

interface CustomBookingProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomBooking({ isOpen, onClose }: CustomBookingProps) {
  const [step, setStep] = useState<'select-type' | 'select-date' | 'select-time' | 'form' | 'success'>('select-type');
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const { toasts, addToast, removeToast, success, error } = useToast();

  // Generate next 14 days excluding weekends
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    let currentDate = new Date(today); // Start from today

    while (dates.length < 10) {
      // Include all days - no weekend exclusion
      // Use local date formatting to avoid timezone issues
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      dates.push(dateString);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const availableDates = generateAvailableDates();

  // Fetch availability for selected date
  const fetchAvailability = async (date: string) => {
    setLoadingAvailability(true);
    try {
      const response = await fetch(`/api/availability?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setTimeSlots(data.timeSlots);
      } else {
        error('Failed to load available time slots');
        // Fallback to default slots
        setTimeSlots([
          { time: '09:00 AM', value: '09:00', available: true },
          { time: '10:00 AM', value: '10:00', available: true },
          { time: '11:00 AM', value: '11:00', available: true },
          { time: '01:00 PM', value: '13:00', available: true },
          { time: '02:00 PM', value: '14:00', available: true },
          { time: '03:00 PM', value: '15:00', available: true },
          { time: '04:00 PM', value: '16:00', available: true },
        ]);
      }
    } catch (err) {
      error('Failed to check availability');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const meetingPlatforms = [
    { id: 'zoom', name: 'Zoom Call', icon: VideoCameraIcon, description: 'Video call via Zoom' },
    { id: 'google-meet', name: 'Google Meet', icon: VideoCameraIcon, description: 'Video call via Google Meet' },
    { id: 'phone', name: 'Phone Call', icon: PhoneIcon, description: 'Traditional phone call' },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchMeetingTypes();
    }
  }, [isOpen]);

  const fetchMeetingTypes = async () => {
    try {
      const response = await fetch('/api/meeting-types');
      if (response.ok) {
        const types = await response.json();
        setMeetingTypes(types);
      }
    } catch (error) {
      console.error('Error fetching meeting types:', error);
      // Fallback data
      setMeetingTypes([
        {
          id: '1',
          name: 'Discovery Call',
          slug: 'discovery-call',
          description: 'Initial consultation to discuss your project goals and requirements',
          duration_minutes: 30,
          color: '#ffc312'
        }
      ]);
    }
  };

  const formatDate = (dateStr: string) => {
    // Parse the date string components to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleMeetingTypeSelect = (meetingType: MeetingType) => {
    setSelectedMeetingType(meetingType);
    setStep('select-date');
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setStep('select-time');
    await fetchAvailability(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.target as HTMLFormElement);

      const appointmentData = {
        meeting_type: selectedMeetingType?.slug,
        scheduled_date: selectedDate,
        scheduled_time: timeSlots.find(slot => slot.time === selectedTime)?.value || convertTo24Hour(selectedTime),
        duration_minutes: selectedMeetingType?.duration_minutes,
        client_name: formData.get('name') as string,
        client_email: formData.get('email') as string,
        client_phone: formData.get('phone') as string,
        company_name: formData.get('company') as string,
        meeting_platform: formData.get('platform') as string,
        project_details: formData.get('details') as string,
        timezone: 'America/Chicago', // You can make this dynamic
      };

      console.log('Frontend sending appointment data:', appointmentData);
      console.log('Selected date from state:', selectedDate);
      console.log('Selected time from state:', selectedTime);

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 409) {
          error('Sorry, this time slot has already been booked by someone else. Please select a different time.');
          setStep('select-time'); // Go back to time selection
          await fetchAvailability(selectedDate); // Refresh availability
          return;
        }

        throw new Error(errorData.error || 'Failed to schedule appointment');
      }

      const result = await response.json();
      success('Meeting scheduled successfully! You\'ll receive a confirmation email shortly.');
      setStep('success');
    } catch (catchError) {
      console.error('Booking error:', catchError);
      if (catchError.message.includes('409') || catchError.message.includes('conflict')) {
        error('Sorry, this time slot has already been booked. Please select a different time.');
        setStep('select-time');
        await fetchAvailability(selectedDate); // Refresh availability
      } else {
        error('Failed to schedule appointment. Please try again or contact us directly at reece@nunezdev.com');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12 + '';
    }
    return `${hours}:${minutes}`;
  };

  const resetForm = () => {
    setStep('select-type');
    setSelectedMeetingType(null);
    setSelectedDate('');
    setSelectedTime('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl border border-offwhite/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-offwhite/10">
            <h2 className="text-2xl font-bold text-yellow">Schedule a Meeting</h2>
            <button
              onClick={onClose}
              className="text-offwhite hover:text-yellow transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'select-type' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">Choose Meeting Type</h3>
                  <p className="text-white/70">Select the type of meeting that best fits your needs</p>
                </div>

                <div className="grid gap-4">
                  {meetingTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleMeetingTypeSelect(type)}
                      className="p-4 rounded-lg border border-offwhite/20 text-left hover:border-yellow hover:bg-yellow/5 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white group-hover:text-yellow transition-colors">
                            {type.name}
                          </h4>
                          <p className="text-white/70 text-sm mt-1">{type.description}</p>
                          <p className="text-yellow text-sm mt-2">{type.duration_minutes} minutes</p>
                        </div>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'select-date' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <CalendarDaysIcon className="w-12 h-12 text-yellow mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Select a Date</h3>
                  <p className="text-white/70">
                    {selectedMeetingType?.name} ({selectedMeetingType?.duration_minutes} minutes)
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {availableDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => handleDateSelect(date)}
                      className="p-4 rounded-lg border border-offwhite/20 text-left hover:border-yellow hover:bg-yellow/5 transition-all text-white"
                    >
                      {formatDate(date)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep('select-type')}
                  className="text-yellow hover:text-yellow/80 transition-colors"
                >
                  ← Back to meeting types
                </button>
              </motion.div>
            )}

            {step === 'select-time' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <ClockIcon className="w-12 h-12 text-yellow mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Select a Time</h3>
                  <p className="text-white/70">{formatDate(selectedDate)}</p>
                </div>

                {loadingAvailability ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-3 text-white">
                      <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m12 2v4m0 12v4m10-10h-4M6 12H2m15.364-7.364l-2.828 2.828M9.464 16.536L6.636 19.364M16.536 6.636L19.364 9.464M6.636 4.636L9.464 7.464"></path>
                      </svg>
                      <span>Checking availability...</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && handleTimeSelect(slot.time)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          slot.available
                            ? 'border-offwhite/20 text-white hover:border-yellow hover:bg-yellow/5'
                            : 'border-red-200/30 cursor-not-allowed bg-red-900/10'
                        }`}
                      >
                        <div className={`font-medium ${slot.available ? 'text-white' : 'text-red-300'}`}>
                          {slot.time}
                        </div>
                        {!slot.available && (
                          <div className="text-xs text-red-400 font-medium mt-1">
                            Booked
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!loadingAvailability && timeSlots.filter(slot => slot.available).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-white/70 mb-4">No available time slots for this date.</p>
                    <p className="text-white/50 text-sm">Please select a different date.</p>
                  </div>
                )}

                <button
                  onClick={() => setStep('select-date')}
                  className="text-yellow hover:text-yellow/80 transition-colors"
                >
                  ← Back to dates
                </button>
              </motion.div>
            )}

            {step === 'form' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">Almost There!</h3>
                  <p className="text-white/70">
                    {selectedMeetingType?.name} on {formatDate(selectedDate)} at {selectedTime}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-medium mb-2">Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full p-3 rounded-lg bg-gray-800 border border-offwhite/30 text-white placeholder-gray-400 focus:border-yellow focus:outline-none focus:bg-gray-700"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">Email *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="w-full p-3 rounded-lg bg-gray-800 border border-offwhite/30 text-white placeholder-gray-400 focus:border-yellow focus:outline-none focus:bg-gray-700"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-medium mb-2">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        className="w-full p-3 rounded-lg bg-gray-800 border border-offwhite/30 text-white placeholder-gray-400 focus:border-yellow focus:outline-none focus:bg-gray-700"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">Company</label>
                      <input
                        type="text"
                        name="company"
                        className="w-full p-3 rounded-lg bg-gray-800 border border-offwhite/30 text-white placeholder-gray-400 focus:border-yellow focus:outline-none focus:bg-gray-700"
                        placeholder="Your company name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">Meeting Platform *</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {meetingPlatforms.map((platform) => (
                        <label key={platform.id} className="relative">
                          <input
                            type="radio"
                            name="platform"
                            value={platform.id}
                            required
                            className="sr-only peer"
                          />
                          <div className="p-3 rounded-lg border border-offwhite/20 peer-checked:border-yellow peer-checked:bg-yellow/5 cursor-pointer transition-all">
                            <div className="flex items-center gap-3">
                              <platform.icon className="w-5 h-5 text-white peer-checked:text-yellow" />
                              <div>
                                <div className="font-medium text-white">{platform.name}</div>
                                <div className="text-sm text-white/70">{platform.description}</div>
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">Project Details</label>
                    <textarea
                      rows={4}
                      name="details"
                      className="w-full p-3 rounded-lg bg-gray-800 border border-offwhite/30 text-white placeholder-gray-400 focus:border-yellow focus:outline-none resize-none focus:bg-gray-700"
                      placeholder="Tell me about your project, goals, and what you'd like to discuss..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('select-time')}
                      className="flex-1 py-3 border border-offwhite/20 text-white rounded-lg hover:bg-offwhite/5 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-3 bg-yellow text-black font-semibold rounded-lg hover:bg-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading && (
                        <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m12 2v4m0 12v4m10-10h-4M6 12H2m15.364-7.364l-2.828 2.828M9.464 16.536L6.636 19.364M16.536 6.636L19.364 9.464M6.636 4.636L9.464 7.464"></path>
                        </svg>
                      )}
                      {isLoading ? 'Scheduling Meeting...' : 'Schedule Meeting'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-8"
              >
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">You're All Set!</h3>
                  <p className="text-white/70 mb-4">
                    Your {selectedMeetingType?.name.toLowerCase()} is scheduled for {formatDate(selectedDate)} at {selectedTime}
                  </p>
                  <p className="text-sm text-white/60">
                    You'll receive a confirmation email shortly with meeting details and calendar invite.
                  </p>
                </div>

                <button
                  onClick={resetForm}
                  className="bg-yellow text-black font-semibold px-8 py-3 rounded-lg hover:bg-yellow/90 transition-colors"
                >
                  Done
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AnimatePresence>
  );
}