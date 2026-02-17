'use client';

import { useEffect } from 'react';
import type { Toast } from '@/hooks/useToast';

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export function ToastItem({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColor = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }[toast.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  }[toast.type];

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${bgColor} shadow-lg animate-in slide-in-from-right`}>
      <span className="text-sm font-medium">{icon}</span>
      <span className="text-sm">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-auto text-xs opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[], onRemove: (id: string) => void }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}