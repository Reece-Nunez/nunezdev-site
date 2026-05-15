'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatBytes,
  getFileExtension,
} from '@/lib/uploadConstants';

export interface UploadedFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string | null;
  status: string;
  createdAt: string;
}

interface FileDropzoneProps {
  projectId: string;
  onUploadStart: (file: File) => void;
  onUploadProgress: (file: File, progress: number) => void;
  onUploadComplete: (file: File, info: UploadedFileInfo) => void;
  onUploadError: (file: File, error: string) => void;
  onRetry?: (handler: (file: File) => void) => void;
  disabled?: boolean;
}

const MAX_CONCURRENT_UPLOADS = 3;

function isAllowed(file: File): boolean {
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  return ALLOWED_EXTENSIONS.includes(getFileExtension(file.name));
}

function describeRejection(file: File): string {
  const ext = getFileExtension(file.name);
  const name = file.name || 'this file';

  if (ext === '.mov' || ext === '.mp4' || ext === '.avi' || ext === '.mkv' || ext === '.webm' || file.type.startsWith('video/')) {
    return `"${name}" is a video file. Videos aren't supported yet — please upload a photo or screenshot instead.`;
  }
  if (ext === '.doc' || ext === '.docx' || ext === '.pages') {
    return `"${name}" is a Word document. Please export it as a PDF and upload that instead.`;
  }
  if (ext === '.xls' || ext === '.xlsx' || ext === '.numbers' || ext === '.csv') {
    return `"${name}" is a spreadsheet. Please export it as a PDF and upload that instead.`;
  }
  if (ext === '.ppt' || ext === '.pptx' || ext === '.key') {
    return `"${name}" is a presentation. Please export it as a PDF and upload that instead.`;
  }
  if (ext === '.zip' || ext === '.rar' || ext === '.7z' || ext === '.tar' || ext === '.gz') {
    return `"${name}" is an archive. Please unzip it and upload the individual files.`;
  }
  if (ext === '.txt' || ext === '.rtf' || ext === '.md') {
    return `"${name}" is a text file. Please convert to PDF or paste the contents into a message instead.`;
  }
  if (ext === '.bmp' || ext === '.tiff' || ext === '.tif') {
    return `"${name}" uses an older image format. On a computer, open it and save/export as JPEG or PNG, then upload that.`;
  }
  if (!ext && !file.type) {
    return `"${name}" has no file extension, so we can't tell what type it is. Please rename it with the correct extension (e.g., .jpg) and try again.`;
  }
  const what = ext ? ext.toUpperCase().replace('.', '') : (file.type || 'unknown');
  return `"${name}" is a ${what} file, which isn't supported. Allowed: JPEG, PNG, GIF, WebP, SVG, HEIC, or PDF.`;
}

export default function FileDropzone({
  projectId,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onRetry,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  // Concurrency: cap simultaneous uploads to avoid stalling on flaky mobile connections.
  const activeCountRef = useRef(0);
  const queueRef = useRef<File[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsTouch(
      'ontouchstart' in window ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      onUploadStart(file);

      try {
        // Step 1: ask our server for a pre-signed S3 URL
        let presignRes: Response;
        try {
          presignRes = await fetch('/api/portal/uploads/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
            }),
          });
        } catch {
          throw new Error(`Couldn't reach our server to start the upload — check your internet connection and try again.`);
        }

        if (!presignRes.ok) {
          let serverMessage = '';
          try {
            const body = await presignRes.json();
            serverMessage = body?.error || '';
          } catch {
            // body wasn't JSON
          }

          if (presignRes.status === 401) {
            throw new Error('Your session expired. Please refresh the page and sign in again.');
          }
          if (presignRes.status === 404) {
            throw new Error('This project is no longer active. Refresh the page or pick a different project.');
          }
          if (presignRes.status === 400 && serverMessage) {
            throw new Error(serverMessage);
          }
          if (presignRes.status >= 500) {
            throw new Error(`Our server hit an error (${presignRes.status}) while preparing the upload. Please try again in a moment.`);
          }
          throw new Error(serverMessage || `Couldn't prepare the upload (HTTP ${presignRes.status}). Please try again.`);
        }

        const { uploadId, presignedUrl, contentType } = await presignRes.json();

        // Step 2: PUT the file directly to S3 with progress tracking
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
              return;
            }
            if (xhr.status === 403) {
              reject(new Error('The upload link expired before the file finished. Please try uploading again.'));
            } else if (xhr.status === 413) {
              reject(new Error(`"${file.name}" is too large for our storage. Try compressing or resizing it first.`));
            } else if (xhr.status >= 500) {
              reject(new Error(`Our storage provider returned an error (${xhr.status}). Please try again in a moment.`));
            } else if (xhr.status === 0) {
              reject(new Error('The upload was interrupted. Check your internet connection and try again.'));
            } else {
              reject(new Error(`Upload failed (HTTP ${xhr.status}). Please try again.`));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Your internet connection dropped while uploading. Please reconnect and try again.'));
          };

          xhr.ontimeout = () => {
            reject(new Error('The upload took too long and timed out. On a slow connection, try a smaller file or move closer to Wi-Fi.'));
          };

          xhr.onabort = () => {
            reject(new Error('Upload was cancelled.'));
          };

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', contentType || file.type || 'application/octet-stream');
          xhr.send(file);
        });

        // Step 3: confirm completion on our server
        let completeRes: Response;
        try {
          completeRes = await fetch('/api/portal/uploads/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, success: true }),
          });
        } catch {
          throw new Error(`"${file.name}" uploaded, but we couldn't confirm it with our server. Refresh the page — if you don't see it, please re-upload.`);
        }

        if (!completeRes.ok) {
          if (completeRes.status === 401) {
            throw new Error('Your session expired right after the upload. Please sign in again — your file is safe but not yet linked to the project.');
          }
          throw new Error(`"${file.name}" uploaded, but our server couldn't save the record (HTTP ${completeRes.status}). Please try uploading it again.`);
        }

        const completeBody = await completeRes.json();
        const info: UploadedFileInfo = completeBody.upload ?? {
          id: uploadId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: contentType || file.type || 'application/octet-stream',
          url: null,
          status: 'completed',
          createdAt: new Date().toISOString(),
        };
        onUploadComplete(file, info);
      } catch (error) {
        onUploadError(
          file,
          error instanceof Error ? error.message : `We couldn't upload "${file.name}". Please try again.`
        );
      }
    },
    [projectId, onUploadStart, onUploadProgress, onUploadComplete, onUploadError]
  );

  // Process the queue: while we have capacity and waiting files, kick off uploads.
  const drainQueue = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      activeCountRef.current += 1;
      // Fire and forget — uploadFile reports errors via callbacks.
      void uploadFile(next).finally(() => {
        activeCountRef.current -= 1;
        drainQueue();
      });
    }
  }, [uploadFile]);

  const enqueueUpload = useCallback(
    (file: File) => {
      queueRef.current.push(file);
      drainQueue();
    },
    [drainQueue]
  );

  // Expose a retry handler to the parent so failed uploads can be re-queued.
  useEffect(() => {
    onRetry?.(enqueueUpload);
  }, [onRetry, enqueueUpload]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || disabled) return;

      Array.from(files).forEach((file) => {
        if (file.size === 0) {
          onUploadError(file, `"${file.name}" is empty (0 bytes). The file may not have copied correctly — try re-selecting it.`);
          return;
        }

        if (!isAllowed(file)) {
          onUploadError(file, describeRejection(file));
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          onUploadError(
            file,
            `"${file.name}" is ${formatBytes(file.size)} — over the 100MB limit. Please resize or compress the file (try a photo editor or an online compressor) and try again.`
          );
          return;
        }

        enqueueUpload(file);
      });
    },
    [disabled, enqueueUpload, onUploadError]
  );

  const openFilePicker = useCallback(
    (camera = false) => {
      if (disabled) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = !camera;
      input.accept = camera ? 'image/*' : [...ALLOWED_MIME_TYPES, ...ALLOWED_EXTENSIONS].join(',');
      if (camera) {
        input.setAttribute('capture', 'environment');
      }
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        handleFiles(target.files);
      };
      input.click();
    },
    [disabled, handleFiles]
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
    <div>
      <motion.div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer ${
          isDragging
            ? 'border-yellow-400 bg-yellow-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => openFilePicker(false)}
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
                {isTouch ? 'Tap to add files' : 'Drag and drop files here'}
              </p>
              {!isTouch && (
                <p className="text-slate-500 text-sm">or click to browse</p>
              )}
              <p className="text-slate-400 text-xs mt-3">
                JPEG, PNG, GIF, WebP, SVG, HEIC, PDF (max 100MB)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isTouch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openFilePicker(true);
          }}
          disabled={disabled}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take Photo
        </button>
      )}
    </div>
  );
}
