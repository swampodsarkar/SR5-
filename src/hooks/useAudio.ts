import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';

const BEEP_FREQ = 800;
const BEEP_DURATION = 0.05;

export function useAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize lazily based on interaction to avoid autoplay blocks
    const handleInteraction = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new window.AudioContext();
      }
    };
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  const playNavigationSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const { soundOn, systemVolume } = useUIStore.getState();
    if (!soundOn) return;

    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(BEEP_FREQ, audioCtxRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtxRef.current.currentTime + BEEP_DURATION);

    const targetVolume = 0.1 * (systemVolume / 100);
    gainNode.gain.setValueAtTime(targetVolume, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + BEEP_DURATION);

    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    osc.start();
    osc.stop(audioCtxRef.current.currentTime + BEEP_DURATION);
  }, []);

  const playSelectSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const { soundOn, systemVolume } = useUIStore.getState();
    if (!soundOn) return;

    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, audioCtxRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtxRef.current.currentTime + 0.1);

    const targetVolume = 0.2 * (systemVolume / 100);
    gainNode.gain.setValueAtTime(targetVolume, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    osc.start();
    osc.stop(audioCtxRef.current.currentTime + 0.1);
  }, []);

  return { playNavigationSound, playSelectSound };
}
