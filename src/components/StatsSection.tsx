"use client";

import { motion, Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

const stats = [
  { label: "Projects Completed", value: 35, suffix: "+" },
  { label: "Happy Clients", value: 8, suffix: "" },
  { label: "Years Experience", value: 4, suffix: "+" },
  { label: "States Served", value: 7, suffix: "" },
];

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
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 text-center"
        >
          <div className="text-yellow text-2xl sm:text-3xl md:text-4xl font-bold mb-1">
            <AnimatedCounter target={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-white/50 text-sm">{stat.label}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
