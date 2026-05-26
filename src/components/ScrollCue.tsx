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

  // Positioned absolutely inside the Hero (Hero is `relative`) so the
  // cue sits at the bottom of the hero section and scrolls away with
  // it. Previously `fixed bottom-12` glued it to the viewport, which
  // overlapped the about-card now that the hero is min-h-[85vh].
  return (
    <div className="absolute bottom-8 left-0 w-full flex justify-center z-30 pointer-events-none">
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
