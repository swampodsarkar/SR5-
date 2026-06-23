import { motion, AnimatePresence } from "framer-motion";
import { Bell, Download, MessageSquare, Trophy, Users, Power } from "lucide-react";
import { useState, useEffect } from "react";
import { useAudio } from "../hooks/useAudio";
import { useGamepad } from "../hooks/useGamepad";

const ControlCenterItems = [
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'friends', title: 'Game Base', icon: Users },
  { id: 'messages', title: 'Messages', icon: MessageSquare },
  { id: 'downloads', title: 'Downloads/Uploads', icon: Download },
  { id: 'trophies', title: 'Trophies', icon: Trophy },
  { id: 'power', title: 'Power', icon: Power },
];

export function ControlCenter({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { playNavigationSound, playSelectSound } = useAudio();

  // Listen for escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!isOpen) return;
      
      if (e.key === 'ArrowLeft') {
        playNavigationSound();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        playNavigationSound();
        setSelectedIndex(prev => Math.min(ControlCenterItems.length - 1, prev + 1));
      } else if (e.key === 'Enter') {
        playSelectSound();
        // action
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, playNavigationSound, playSelectSound, onClose]);

  // Use PS button (usually index 16 or middle) or D-pad if active
  useGamepad((dir) => {
    if (!isOpen) return;
    if (dir === 'LEFT') {
      playNavigationSound();
      setSelectedIndex(prev => Math.max(0, prev - 1));
    }
    if (dir === 'RIGHT') {
      playNavigationSound();
      setSelectedIndex(prev => Math.min(ControlCenterItems.length - 1, prev + 1));
    }
  }, () => {
    if (isOpen) playSelectSound();
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 w-full h-32 bg-black/60 backdrop-blur-xl border-t border-white/10 z-50 flex items-center justify-center gap-8"
          >
             <div className="absolute top-[-3rem] left-1/2 -translate-x-1/2 text-white/80 font-medium tracking-wide bg-black/50 px-6 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
               {ControlCenterItems[selectedIndex].title}
             </div>
             
             {ControlCenterItems.map((item, i) => {
               const Icon = item.icon;
               const isSelected = i === selectedIndex;
               return (
                 <motion.button
                   key={item.id}
                   className={`relative rounded-xl flex items-center justify-center transition-all ${isSelected ? 'w-16 h-16 bg-white/20' : 'w-12 h-12 bg-transparent hover:bg-white/10'}`}
                   onClick={() => {
                     setSelectedIndex(i);
                     playNavigationSound();
                   }}
                 >
                   <Icon className={`transition-all ${isSelected ? 'w-8 h-8 text-white' : 'w-6 h-6 text-white/60'}`} />
                   {isSelected && (
                     <motion.div 
                       layoutId="control-focus"
                       className="absolute -bottom-2 w-1.5 h-1.5 rounded-full bg-white"
                     />
                   )}
                 </motion.button>
               )
             })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
