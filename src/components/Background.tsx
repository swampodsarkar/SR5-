import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useUIStore } from '../store/uiStore';

function Particles({ themeColor }: { themeColor: string }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 600;
  
  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const ph = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15; // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 4; // z
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, ph];
  }, [particleCount]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 1] += Math.sin(time * 0.4 + phases[i]) * 0.001;
      positions[i * 3] += Math.cos(time * 0.3 + phases[i]) * 0.0005;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y = Math.sin(time * 0.05) * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={new THREE.Color(themeColor).lerp(new THREE.Color('#ffffff'), 0.6)} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Bubbles({ themeColor }: { themeColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const bubbleCount = 35;

  const bubblesData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < bubbleCount; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 14,
        y: (Math.random() - 0.5) * 14 - 2,
        z: Math.random() * 4 - 4,
        baseScale: Math.random() * 0.28 + 0.1,
        speed: Math.random() * 0.007 + 0.003,
        wobbleSpeed: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [bubbleCount]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const children = groupRef.current.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      const data = bubblesData[i];
      if (!data) continue;

      // Make bubbles rise continuously
      child.position.y += data.speed;
      
      // Natural side-to-side sway
      child.position.x += Math.sin(time * data.wobbleSpeed + data.phase) * 0.004;

      // Wrap-around if bubble reaches the top of the viewport
      if (child.position.y > 7) {
        child.position.y = -7;
        child.position.x = (Math.random() - 0.5) * 14;
      }

      // Soft dynamic size pulse for breathing bubble effect
      const pulse = 1.0 + Math.sin(time * 1.5 + data.phase) * 0.07;
      child.scale.set(
        data.baseScale * pulse,
        data.baseScale * pulse,
        data.baseScale * pulse
      );
    }
  });

  return (
    <group ref={groupRef}>
      {bubblesData.map((data, idx) => (
        <mesh key={idx} position={[data.x, data.y, data.z]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshPhysicalMaterial
            color={new THREE.Color(themeColor).lerp(new THREE.Color('#ffffff'), 0.5)}
            transmission={0.8}
            ior={1.2}
            roughness={0.05}
            metalness={0.1}
            thickness={0.8}
            transparent
            opacity={0.4}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Background() {
  const { activeWallpaper, activeThemeColor } = useUIStore();

  return (
    <div 
      className="fixed inset-0 -z-10 transition-all duration-1000 ease-in-out"
      style={{ background: activeWallpaper?.startsWith('http') ? `url('${activeWallpaper}') center/cover no-repeat fixed` : (activeWallpaper || '#111') }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} className="absolute inset-0 opacity-90 pointer-events-none">
        <fog attach="fog" args={['#000', 3, 15]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 2]} intensity={1.5} />
        <pointLight position={[-4, -5, 3]} intensity={1.2} color={activeThemeColor} />
        
        <Particles themeColor={activeThemeColor} />
        <Bubbles themeColor={activeThemeColor} />
      </Canvas>
    </div>
  );
}
