"use client";

import { useRef, useEffect, useCallback } from "react";

interface Particle {
  originX: number;
  originY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

interface ParticleLogoProps {
  src: string;
  width: number;
  height: number;
}

export default function ParticleLogo({ src, width, height }: ParticleLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const prevMouseRef = useRef({ x: -9999, y: -9999 });
  const mousePointsRef = useRef<{ x: number; y: number }[]>([]);
  const animFrameRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  const padding = 140;
  const canvasW = width + padding * 2;
  const canvasH = height + padding * 2;
  const mouseRadius = 100;
  const repelForce = 14;

  const initParticles = useCallback(() => {
    if (isInitializedRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, width, height);
      const imageData = offCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const particles: Particle[] = [];
      const step = 3;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          const a = data[i + 3];
          if (a > 50) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            particles.push({
              originX: x + padding,
              originY: y + padding,
              x: x + padding,
              y: y + padding,
              vx: 0,
              vy: 0,
              color: `rgb(${r},${g},${b})`,
              size: 2 + Math.random() * 1.5,
            });
          }
        }
      }

      particlesRef.current = particles;
      isInitializedRef.current = true;
    };
    img.src = src;
  }, [src, width, height, padding]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;

    // Store previous position
    prevMouseRef.current.x = mouseRef.current.x;
    prevMouseRef.current.y = mouseRef.current.y;

    mouseRef.current.x = nx;
    mouseRef.current.y = ny;

    // Interpolate between prev and current mouse positions
    const px = prevMouseRef.current.x;
    const py = prevMouseRef.current.y;
    const points: { x: number; y: number }[] = [];

    if (px > -9000) {
      const dx = nx - px;
      const dy = ny - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(dist / (mouseRadius * 0.4)));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push({ x: px + dx * t, y: py + dy * t });
      }
    } else {
      points.push({ x: nx, y: ny });
    }

    mousePointsRef.current = points;
  }, [mouseRadius]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.x = -9999;
    mouseRef.current.y = -9999;
    prevMouseRef.current.x = -9999;
    prevMouseRef.current.y = -9999;
    mousePointsRef.current = [];
  }, []);

  useEffect(() => {
    initParticles();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvasW, canvasH);

      const points = mousePointsRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];

        // Mouse repulsion — check against interpolated path points and current position
        let maxForceX = 0;
        let maxForceY = 0;
        let maxForceMag = 0;

        const checkRepel = (cx: number, cy: number) => {
          const dmx = p.x - cx;
          const dmy = p.y - cy;
          const distSq = dmx * dmx + dmy * dmy;
          const rSq = mouseRadius * mouseRadius;

          if (distSq < rSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = ((mouseRadius - dist) / mouseRadius) * repelForce;
            if (force > maxForceMag) {
              maxForceMag = force;
              maxForceX = (dmx / dist) * force;
              maxForceY = (dmy / dist) * force;
            }
          }
        };

        // Check all interpolated path points
        for (let j = 0; j < points.length; j++) {
          checkRepel(points[j].x, points[j].y);
        }
        // Always check current mouse position too
        if (mx > -9000) {
          checkRepel(mx, my);
        }

        p.vx += maxForceX;
        p.vy += maxForceY;

        // Spring back to origin + idle float
        const floatX = Math.sin(time * 0.0015 + i * 0.3) * 0.8;
        const floatY = Math.cos(time * 0.002 + i * 0.5) * 0.8;
        const dx = (p.originX + floatX) - p.x;
        const dy = (p.originY + floatY) - p.y;

        p.vx += dx * 0.04;
        p.vy += dy * 0.04;

        // Damping
        p.vx *= 0.88;
        p.vy *= 0.88;

        p.x += p.vx;
        p.y += p.vy;

        // Draw with glow
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ffc312";
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.restore();
      }

      // Clear interpolated points after processing (use current pos only until next move)
      mousePointsRef.current = [];

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasW, canvasH, initParticles, mouseRadius, repelForce]);

  return (
    <div
      style={{ width, height, position: "relative", overflow: "visible" }}
      className="flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-pointer absolute"
        style={{
          width: canvasW,
          height: canvasH,
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%)`,
        }}
      />
    </div>
  );
}
