"use client";

import { useEffect, useState, useMemo } from "react";

export function TypewriterText() {
  const phrases = useMemo(
    () => [
      "I build websites.",
      "I build custom dashboards.",
      "I build internal tools.",
      "I build scheduling systems.",
      "I build what you need.",
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentPhrase = phrases[index];
    if (charIndex <= currentPhrase.length) {
      const timeout = setTimeout(() => {
        setDisplayText(currentPhrase.slice(0, charIndex));
        setCharIndex((prev) => prev + 1);
      }, 75);
      return () => clearTimeout(timeout);
    } else {
      const pause = setTimeout(() => {
        setCharIndex(0);
        setIndex((prev) => (prev + 1) % phrases.length);
      }, 2000);
      return () => clearTimeout(pause);
    }
  }, [charIndex, index, phrases]);

  return (
    <span>
      {displayText}
      <span className="animate-pulse border-r-2 border-white ml-1" />
    </span>
  );
}
