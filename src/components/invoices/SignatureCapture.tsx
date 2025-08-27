'use client';

import { useState, useRef } from 'react';
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
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Digital Signature *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                width: 500,
                height: 200,
                className: 'signature-canvas w-full'
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Signature
            </button>
            <p className="text-sm text-gray-500">
              Sign above using your mouse or touch device
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>By signing this invoice, I acknowledge that:</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-1 list-disc list-inside">
            <li>I have reviewed the invoice details and agree to the stated terms</li>
            <li>I authorize the work described and agree to pay the amount due</li>
            <li>This digital signature has the same legal effect as a handwritten signature</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#ffc312' }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#e6ad0f')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffc312')}
          >
            {isSubmitting ? 'Saving Signature...' : 'Sign & Accept Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}