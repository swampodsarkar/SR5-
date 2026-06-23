import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";

export function BootScreen() {
  const { isBooting, finishBooting, consoleName } = useUIStore();
  const { playSelectSound } = useAudio();

  useEffect(() => {
    if (isBooting) {
      const t = setTimeout(() => {
        finishBooting();
        // Play a sound when boot finishes to signify system is ready
        setTimeout(() => playSelectSound(), 500);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [isBooting, finishBooting, playSelectSound]);

  return (
    <AnimatePresence>
      {isBooting && (
        <motion.div
          className="fixed inset-0 z-[999] bg-black flex items-center justify-center flex-col pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          {/* Logo animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="text-7xl md:text-8xl font-light tracking-[0.15em] uppercase text-white flex items-center gap-4 text-center px-4"
          >
            {consoleName}
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 2, duration: 1.5 }}
            className="text-[10px] text-white/30 tracking-widest uppercase absolute bottom-12"
          >
            Warning: Read Health and Safety Information Before Playing
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
