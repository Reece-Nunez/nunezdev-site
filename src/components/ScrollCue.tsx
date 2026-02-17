"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";

export default function ScrollCue() {
  const [showCue, setShowCue] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCue(true), 3000);

    const handleScroll = () => {
      if (window.scrollY > 10) setScrolled(true);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (!showCue || scrolled) return null;

  return (
    <div className="fixed bottom-12 left-0 w-full flex justify-center z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center"
      >
        <p className="text-yellow text-sm uppercase tracking-widest mb-1">
          Keep Scrolling
        </p>
        <FaChevronDown className="text-yellow text-xl animate-bounce" />
      </motion.div>
    </div>
  );
}
