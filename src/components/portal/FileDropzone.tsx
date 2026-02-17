'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileDropzoneProps {
  projectId: string;
  onUploadStart: (file: File) => void;
  onUploadProgress: (file: File, progress: number) => void;
  onUploadComplete: (file: File, url: string) => void;
  onUploadError: (file: File, error: string) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function FileDropzone({
  projectId,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      onUploadStart(file);

      try {
        // Get pre-signed URL
        const presignRes = await fetch('/api/portal/uploads/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignRes.ok) {
          const error = await presignRes.json();
          throw new Error(error.error || 'Failed to get upload URL');
        }

        const { uploadId, presignedUrl } = await presignRes.json();

        // Upload to S3 with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              onUploadProgress(file, progress);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Upload failed'));
          };

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Confirm upload complete
        const completeRes = await fetch('/api/portal/uploads/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, success: true }),
        });

        if (!completeRes.ok) {
          throw new Error('Failed to confirm upload');
        }

        const { url } = await completeRes.json();
        onUploadComplete(file, url);
      } catch (error) {
        onUploadError(file, error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [projectId, onUploadStart, onUploadProgress, onUploadComplete, onUploadError]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || disabled) return;

      Array.from(files).forEach((file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          onUploadError(file, 'File type not allowed');
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          onUploadError(file, 'File too large (max 100MB)');
          return;
        }

        uploadFile(file);
      });
    },
    [disabled, uploadFile, onUploadError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <motion.div
      className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer ${
        isDragging
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-slate-300 hover:border-slate-400 bg-slate-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => {
        if (!disabled) {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = ALLOWED_TYPES.join(',');
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            handleFiles(target.files);
          };
          input.click();
        }
      }}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.99 }}
    >
      <AnimatePresence mode="wait">
        {isDragging ? (
          <motion.div
            key="dragging"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-8"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 bg-yellow-400 rounded-xl mx-auto mb-4 flex items-center justify-center"
            >
              <svg
                className="w-8 h-8 text-slate-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </motion.div>
            <p className="text-xl font-semibold text-slate-900">Drop files here</p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-4"
          >
            <div className="w-16 h-16 bg-slate-200 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-700 mb-1">
              Drag and drop files here
            </p>
            <p className="text-slate-500 text-sm">
              or click to browse
            </p>
            <p className="text-slate-400 text-xs mt-3">
              JPEG, PNG, GIF, WebP, SVG, PDF (max 100MB)
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
