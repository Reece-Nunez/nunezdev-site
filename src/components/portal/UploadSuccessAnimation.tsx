'use client';

import { motion } from 'framer-motion';

interface UploadSuccessAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export default function UploadSuccessAnimation({
  show,
  onComplete,
}: UploadSuccessAnimationProps) {
  if (!show) return null;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        setTimeout(() => onComplete?.(), 1500);
      }}
    >
      <div className="relative">
        {/* Sonar rings */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2.5], opacity: [0.8, 0] }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="w-24 h-24 rounded-full border-4 border-green-400" />
        </motion.div>

        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2], opacity: [0.6, 0] }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        >
          <div className="w-24 h-24 rounded-full border-4 border-green-300" />
        </motion.div>

        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5], opacity: [0.4, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        >
          <div className="w-24 h-24 rounded-full border-4 border-green-200" />
        </motion.div>

        {/* Center circle with checkmark */}
        <motion.div
          className="relative w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-2xl"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
        >
          <motion.svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            />
          </motion.svg>
        </motion.div>
      </div>

      {/* Success text */}
      <motion.div
        className="absolute mt-40 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-xl font-semibold text-green-600">Upload Complete!</p>
      </motion.div>
    </motion.div>
  );
}
