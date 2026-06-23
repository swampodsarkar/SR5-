import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STAGES = [
  { label: "Initializing system modules...", duration: 1200 },
  { label: "Loading emulator cores...", duration: 1000 },
  { label: "Establishing network link...", duration: 1000 },
  { label: "System ready.", duration: 800 },
];

function BootParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 400;
  const [positions] = useState(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
    }
    return pos;
  });

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const p = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 1] += Math.sin(t * 0.3 + i * 0.01) * 0.0008;
      p[i * 3] += Math.cos(t * 0.2 + i * 0.01) * 0.0005;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y = Math.sin(t * 0.03) * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#4488ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function PSWave({ progress }: { progress: number }) {
  const bars = 16;
  return (
    <div className="flex items-end gap-[3px] h-12 mb-4">
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const scale = Math.sin(phase + progress * Math.PI * 4) * 0.5 + 0.5;
        return (
          <motion.div
            key={i}
            className="w-1.5 rounded-full"
            style={{
              height: `${Math.max(4, scale * 48)}px`,
              backgroundColor: i < bars / 4 ? '#3b82f6' : i < bars / 2 ? '#8b5cf6' : i < bars * 0.75 ? '#06b6d4' : '#6366f1',
              opacity: 0.4 + scale * 0.6,
            }}
            animate={{ height: `${Math.max(4, scale * 48)}px` }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

export function BootScreen() {
  const { isBooting, finishBooting, consoleName } = useUIStore();
  const { playSelectSound } = useAudio();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isBooting) return;

    let cancelled = false;
    let totalElapsed = 0;
    const totalDuration = STAGES.reduce((sum, s) => sum + s.duration, 0);

    // Animate wave
    const waveInterval = setInterval(() => setTick(t => t + 1), 50);

    const nextStage = (idx: number) => {
      if (cancelled || idx >= STAGES.length) {
        finishBooting();
        setTimeout(() => playSelectSound(), 500);
        return;
      }
      setStageIndex(idx);
      const stageDuration = STAGES[idx].duration;
      const startTime = Date.now();
      const ticker = setInterval(() => {
        if (cancelled) { clearInterval(ticker); return; }
        const elapsed = Date.now() - startTime;
        const stageProgress = Math.min(1, elapsed / stageDuration);
        const baseProgress = STAGES.slice(0, idx).reduce((s, st) => s + st.duration, 0);
        setProgress((baseProgress + elapsed) / totalDuration);
        if (elapsed >= stageDuration) {
          clearInterval(ticker);
          nextStage(idx + 1);
        }
      }, 30);
    };

    nextStage(0);

    return () => {
      cancelled = true;
      clearInterval(waveInterval);
    };
  }, [isBooting, finishBooting, playSelectSound]);

  return (
    <AnimatePresence>
      {isBooting && (
        <motion.div
          className="fixed inset-0 z-[999] bg-black flex items-center justify-center flex-col"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          {/* Three.js background */}
          <div className="absolute inset-0 opacity-60">
            <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
              <fog attach="fog" args={['#000', 3, 15]} />
              <ambientLight intensity={0.5} />
              <BootParticles />
            </Canvas>
          </div>

          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)',
              backgroundSize: '100% 4px',
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* PS5-style wave */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <PSWave progress={progress} />
            </motion.div>

            {/* Console name */}
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
              className="text-5xl md:text-7xl font-light tracking-[0.18em] uppercase text-white flex items-center gap-4 text-center px-4"
            >
              {consoleName}
            </motion.div>

            {/* Version */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-[10px] text-blue-400/60 tracking-widest font-mono"
            >
              FIRMWARE v2.0.1 • SR5 CLOUD
            </motion.div>

            {/* Boot stage text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="flex flex-col items-center gap-4 mt-4"
            >
              <div className="flex items-center gap-3">
                <motion.span
                  key={stageIndex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-blue-300/80 font-mono tracking-wide"
                >
                  {STAGES[stageIndex]?.label || ''}
                </motion.span>
                <span className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-400"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-64 h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
                    width: `${Math.max(2, progress * 100)}%`,
                  }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </motion.div>
          </div>

          {/* Bottom warning */}
          <motion.div
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 2, duration: 1.5 }}
            className="text-[10px] text-white/20 tracking-widest uppercase absolute bottom-12 font-mono"
          >
            Warning: Read Health and Safety Information Before Playing
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
