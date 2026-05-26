"use client";

import { useEffect, useRef, useState } from "react";
import { homeStats } from "@/data/stats";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const runAnimation = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;
      const duration = 2000;
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const el = ref.current;
    if (!el) return;

    // If the counter is already on-screen at mount, animate immediately —
    // some browsers / extensions delay IntersectionObserver callbacks.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      runAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) runAnimation();
      },
      { threshold: 0.5 }
    );
    observer.observe(el);

    // Safety net: if neither the immediate check nor the observer fires
    // within 4s, snap to the target value so visitors never see a stuck 0.
    const safety = window.setTimeout(() => {
      if (!hasAnimated.current) {
        hasAnimated.current = true;
        setCount(target);
      }
    }, 4000);

    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, [target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
  return (
    <div className="w-full max-w-5xl z-10 px-4 sm:px-8 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-y border-white/10">
        {homeStats.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center sm:text-left py-6 sm:py-8 px-4 sm:px-6 ${
              i >= 2 ? "border-t md:border-t-0 border-white/10" : ""
            }`}
          >
            <div className="text-yellow text-4xl sm:text-5xl md:text-6xl font-bold leading-none tracking-tight">
              <AnimatedCounter target={stat.value} suffix={stat.suffix ?? ""} />
            </div>
            <div className="text-white/40 text-xs sm:text-sm uppercase tracking-wider mt-3">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
