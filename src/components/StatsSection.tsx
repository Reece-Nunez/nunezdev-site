"use client";

import { motion, Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { homeStats } from "@/data/stats";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

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
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } },
      }}
      className="w-full max-w-5xl z-10 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 px-4 sm:px-6"
    >
      {homeStats.map((stat) => (
        <motion.div
          key={stat.label}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 text-center"
        >
          <div className="text-yellow text-2xl sm:text-3xl md:text-4xl font-bold mb-1">
            <AnimatedCounter target={stat.value} suffix={stat.suffix ?? ""} />
          </div>
          <div className="text-white/50 text-sm">{stat.label}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
