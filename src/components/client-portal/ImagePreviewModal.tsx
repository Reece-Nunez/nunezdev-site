'use client';

interface ImagePreviewModalProps {
  previewImage: { url: string; fileName: string } | null;
  onClose: () => void;
}

export default function ImagePreviewModal({ previewImage, onClose }: ImagePreviewModalProps) {
  if (!previewImage) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={previewImage.url}
          alt={previewImage.fileName}
          className="w-full h-full object-contain max-h-[85vh] rounded-lg"
        />
        <p className="text-white text-center mt-2 text-sm">{previewImage.fileName}</p>
      </div>
    </div>
  );
}
