'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface UploadFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
  url?: string;
}

interface UploadProgressProps {
  uploads: UploadFile[];
  onRemove?: (file: File) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string): React.ReactElement {
  if (type.startsWith('image/')) {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export default function UploadProgress({ uploads, onRemove }: UploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="space-y-3 mt-6">
      {uploads.map((upload, index) => (
        <motion.div
          key={`${upload.file.name}-${index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={`bg-white rounded-xl border p-4 ${
            upload.status === 'error'
              ? 'border-red-200'
              : upload.status === 'complete'
              ? 'border-green-200'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                upload.status === 'error'
                  ? 'bg-red-100 text-red-600'
                  : upload.status === 'complete'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {getFileIcon(upload.file.type)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {upload.file.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatFileSize(upload.file.size)}
                {upload.status === 'uploading' && ` - ${upload.progress}%`}
                {upload.status === 'error' && (
                  <span className="text-red-600 ml-2">{upload.error}</span>
                )}
              </p>
            </div>

            {upload.status === 'uploading' && (
              <div className="text-sm font-medium text-slate-600">
                {upload.progress}%
              </div>
            )}

            {upload.status === 'complete' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
            )}

            {upload.status === 'error' && onRemove && (
              <button
                onClick={() => onRemove(upload.file)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {upload.status === 'uploading' && (
            <div className="mt-3">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-200 ease-out"
                  style={{
                    width: `${upload.progress}%`,
                    backgroundColor: '#facc15',
                    minHeight: '12px'
                  }}
                />
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
