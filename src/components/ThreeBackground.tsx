"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useMemo, useEffect, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

function ParticleField({ burst }: { burst: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 8000;
  const originalPositions = useRef<Float32Array | null>(null);
  const burstStart = useRef<number | null>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = THREE.MathUtils.randFloatSpread(40);
    }
    originalPositions.current = positions.slice(); // store original positions
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useEffect(() => {
    if (burst && geometry) {
      burstStart.current = performance.now();
    }
  }, [burst, geometry]);

  useFrame(() => {
    const positions = geometry.attributes.position.array as Float32Array;

    // Idle spin
    if (ref.current) ref.current.rotation.y += 0.0013;

    if (burstStart.current !== null) {
      const elapsed = performance.now() - burstStart.current;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const ox = originalPositions.current![i3];
        const oy = originalPositions.current![i3 + 1];
        const oz = originalPositions.current![i3 + 2];

        const dir = new THREE.Vector3(ox, oy, oz).normalize();
        const magnitude = Math.sin(Math.min(elapsed / 300, 1) * Math.PI) * 10;

        positions[i3] = ox + dir.x * magnitude;
        positions[i3 + 1] = oy + dir.y * magnitude;
        positions[i3 + 2] = oz + dir.z * magnitude;
      }

      geometry.attributes.position.needsUpdate = true;

      if (elapsed > 600) {
        burstStart.current = null;
      }
    }
  });

  const texture = useMemo(() => {
    try {
      const loader = new THREE.TextureLoader();
      return loader.load("/textures/circle.png", undefined, undefined, (error) => {
        console.warn("Failed to load texture:", error);
      });
    } catch (error) {
      console.warn("Error creating texture:", error);
      return null;
    }
  }, []);

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#5b7c99"
        size={0.05}
        sizeAttenuation
        transparent
        blending={THREE.AdditiveBlending}
        opacity={0.8}
        depthWrite={false}
        map={texture}
        alphaTest={0.1}
      />
    </points>
  );
}

function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = mouse.y * 0.1;
      ref.current.rotation.y = mouse.x * 0.1;
    }
  });

  return <group ref={ref}>{children}</group>;
}

export default function ThreeBackground() {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (burst) {
      const timeout = setTimeout(() => setBurst(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [burst]);

  return (
    <ErrorBoundary>
      <div
        className="fixed top-0 left-0 w-full h-full -z-10"
        style={{ pointerEvents: "none" }}
      >
        <Canvas
          camera={{ position: [0, 0, 4], fov: 75 }}
          dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setSize(window.innerWidth, window.innerHeight, false);
          }}
        >
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.7} />
          <ParallaxGroup>
            <ParticleField burst={burst} />
          </ParallaxGroup>
        </Canvas>

        {/* Hidden button to trigger the burst */}
        <button
          id="burstTrigger"
          className="hidden"
          onClick={() => setBurst(true)}
        />
      </div>
    </ErrorBoundary>
  );
}
