'use client';

import { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureCaptureProps {
  onSign: (signatureData: string, signerName: string, signerEmail: string) => Promise<void>;
  onCancel: () => void;
  defaultName?: string;
  defaultEmail?: string;
}

export default function SignatureCapture({ 
  onSign, 
  onCancel, 
  defaultName = '', 
  defaultEmail = '' 
}: SignatureCaptureProps) {
  const [signerName, setSignerName] = useState(defaultName);
  const [signerEmail, setSignerEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

  // Fix signature pad coordinates for mobile
  useEffect(() => {
    const resizeSignaturePad = () => {
      if (signatureRef.current) {
        const canvas = signatureRef.current.getCanvas();
        if (canvas) {
          const container = canvas.parentElement;
          if (container) {
            const rect = container.getBoundingClientRect();
            // Use device pixel ratio for crisp rendering
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = rect.width;
            const displayHeight = window.innerWidth < 640 ? 300 : 180; // Much larger on mobile
            
            // Set display size
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
            
            // Set actual canvas size with device pixel ratio
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            
            // Scale the canvas back down using CSS
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.scale(dpr, dpr);
            }
            
            // Clear any existing signature after resize
            signatureRef.current?.clear();
          }
        }
      }
    };

    // Initial resize after component mounts - multiple attempts for reliability
    const timeouts = [
      setTimeout(resizeSignaturePad, 100),
      setTimeout(resizeSignaturePad, 300),
      setTimeout(resizeSignaturePad, 500)
    ];
    
    // Add event listeners
    window.addEventListener('resize', resizeSignaturePad);
    window.addEventListener('orientationchange', resizeSignaturePad);
    
    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', resizeSignaturePad);
      window.removeEventListener('orientationchange', resizeSignaturePad);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signerName.trim() || !signerEmail.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (signatureRef.current?.isEmpty()) {
      alert('Please provide your signature');
      return;
    }

    const signatureData = signatureRef.current?.toDataURL() || '';
    
    setIsSubmitting(true);
    try {
      await onSign(signatureData, signerName.trim(), signerEmail.trim());
    } catch (error) {
      console.error('Signature submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 sm:p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow"
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Digital Signature *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-0.5 sm:p-1 bg-white overflow-hidden w-full">
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                className: 'signature-canvas w-full block border-0',
                style: {
                  width: '100%',
                  height: typeof window !== 'undefined' && window.innerWidth < 640 ? '300px' : '180px',
                  maxWidth: '100%',
                  display: 'block',
                  touchAction: 'none',
                  border: 'none',
                  cursor: 'crosshair'
                }
              }}
              penColor="black"
              backgroundColor="rgba(255,255,255,1)"
              dotSize={typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 2}
              minWidth={typeof window !== 'undefined' && window.innerWidth < 640 ? 2 : 1}
              maxWidth={typeof window !== 'undefined' && window.innerWidth < 640 ? 7 : 3}
              throttle={typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 8}
              minDistance={typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 3}
              velocityFilterWeight={typeof window !== 'undefined' && window.innerWidth < 640 ? 0.5 : 0.8}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs sm:text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
            <p className="text-xs text-gray-500 text-right">
              Sign using touch or mouse
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>By signing, I acknowledge:</strong>
          </p>
          <ul className="text-xs sm:text-sm text-blue-700 mt-1 list-disc list-inside space-y-0.5">
            <li>I reviewed the invoice and agree to the terms</li>
            <li>I authorize the work and agree to pay</li>
            <li>Digital signature has legal effect</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 sm:pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#ffc312' }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#e6ad0f')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffc312')}
          >
            {isSubmitting ? 'Saving...' : 'Sign & Accept'}
          </button>
        </div>
      </form>
    </div>
  );
}