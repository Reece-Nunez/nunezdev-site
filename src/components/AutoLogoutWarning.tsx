'use client';

import { useState, useEffect } from 'react';

interface AutoLogoutWarningProps {
  isVisible: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogoutNow: () => void;
}

export default function AutoLogoutWarning({
  isVisible,
  remainingSeconds,
  onExtend,
  onLogoutNow,
}: AutoLogoutWarningProps) {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);

  useEffect(() => {
    setTimeLeft(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!isVisible || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, timeLeft]);

  if (!isVisible) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
          Session Timeout Warning
        </h3>
        
        <p className="text-sm text-gray-600 text-center mb-4">
          Your session will expire in{' '}
          <span className="font-mono font-bold text-red-600">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          {' '}due to inactivity.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogoutNow}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}