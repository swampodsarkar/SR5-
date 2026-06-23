import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useUIStore } from "../store/uiStore";
import { MOckGames, SystemApps } from "../data/games";
import { useAudio } from "../hooks/useAudio";
import { Store, Compass, Disc, Gamepad, Gamepad2, Box, Cpu, MonitorPlay, Tv, Layers, Palette, Monitor, Zap, Play, Activity, Flame, Video, Sparkles } from "lucide-react";
import { useGamepad } from "../hooks/useGamepad";

function getIcon(iconName: string | undefined, isSelected: boolean) {
  const className = `w-16 h-16 transition-colors duration-300 ${isSelected ? 'text-white' : 'text-white/40'}`;
  switch (iconName) {
    case 'Disc': return <Disc className={className} />;
    case 'Gamepad': return <Gamepad className={className} />;
    case 'Gamepad2': return <Gamepad2 className={className} />;
    case 'Box': return <Box className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'MonitorPlay': return <MonitorPlay className={className} />;
    case 'Tv': return <Tv className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Palette': return <Palette className={className} />;
    case 'Monitor': return <Monitor className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Play': return <Play className={className} />;
    case 'Activity': return <Activity className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Video': return <Video className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    default: return <Gamepad2 className={className} />;
  }
}

export function GameRow() {
  const { gamesList, setActiveGame, isControlCenterOpen, isPlaying, isSettingsOpen } = useUIStore();
  const allItems = [
    ...SystemApps.map(s => ({ ...s, isSystem: true })),
    ...gamesList,
  ];
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { playNavigationSound, playSelectSound } = useAudio();
  const listRef = useRef<HTMLDivElement>(null);

  // Sync background on index change
  useEffect(() => {
    const item = allItems[selectedIndex];
    if (item && 'wallpaper' in item) {
      setActiveGame(item.id, item.wallpaper, item.themeColor);
    } else {
      setActiveGame('sys', 'linear-gradient(to right bottom, #0f2027, #203a43, #2c5364)', '#203a43');
    }
  }, [selectedIndex, gamesList]);

  const moveLeft = () => {
    const state = useUIStore.getState();
    if (state.isControlCenterOpen || state.isPlaying || state.isSettingsOpen || state.isStoreOpen || state.isProfileOpen || state.isBooting) return;
    if (selectedIndex > 0) {
      playNavigationSound();
      setSelectedIndex(prev => prev - 1);
    }
  };

  const moveRight = () => {
    const state = useUIStore.getState();
    if (state.isControlCenterOpen || state.isPlaying || state.isSettingsOpen || state.isStoreOpen || state.isProfileOpen || state.isBooting) return;
    if (selectedIndex < allItems.length - 1) {
      playNavigationSound();
      setSelectedIndex(prev => prev + 1);
    }
  };

  const selectItem = () => {
    const state = useUIStore.getState();
    if (state.isControlCenterOpen || state.isPlaying || state.isSettingsOpen || state.isStoreOpen || state.isProfileOpen || state.isBooting) return;
    playSelectSound();
    const item = allItems[selectedIndex];
    if (item.id === "store") {
      useUIStore.getState().setStoreOpen(true);
    } else if (item.id === "explore") {
      useUIStore.getState().setProfileOpen(true);
    } else {
      if ('core' in item && item.core) {
        // @ts-ignore - item has romUrl for games
        useUIStore.getState().playGame(item.core, item.romUrl);
      }
    }
  };

  useGamepad((dir) => {
    if (dir === 'LEFT') moveLeft();
    if (dir === 'RIGHT') moveRight();
  }, selectItem);

  // Keyboard support fallback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useUIStore.getState();
      if (state.isControlCenterOpen || state.isPlaying || state.isSettingsOpen || state.isStoreOpen || state.isProfileOpen || state.isBooting) return;
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
      if (e.key === 'Enter') selectItem();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex]);

  return (
    <div className="absolute top-[15vh] left-0 w-full px-12 overflow-visible" ref={listRef}>
      <motion.div 
        className="flex gap-4 items-end"
        initial={false}
        animate={{ x: `calc(15vw - ${selectedIndex * 140}px)` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {allItems.map((item, index) => {
          const isSelected = index === selectedIndex;
          
          return (
            <motion.div
              key={item.id}
              className="relative shrink-0 rounded-2xl overflow-hidden cursor-pointer shadow-2xl"
              initial={false}
              animate={{
                width: isSelected ? 220 : 120,
                height: isSelected ? 220 : 120,
                opacity: Math.abs(index - selectedIndex) > 4 ? 0 : 1,
                y: isSelected ? -20 : 0
              }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              onClick={() => {
                if (index !== selectedIndex) {
                  playNavigationSound();
                  setSelectedIndex(index);
                } else {
                  selectItem();
                }
              }}
            >
              {/* Outer ring for focus */}
              <motion.div 
                className="absolute inset-0 z-20 border-[3px] border-white/0 rounded-2xl pointer-events-none"
                animate={{ borderColor: isSelected ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)' }}
              />

              {item.isSystem ? (
                <div className="w-full h-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                  {item.icon === 'Store' && <Store className={`w-12 h-12 transition-colors duration-300 ${isSelected ? 'text-white' : 'text-white/40'}`} />}
                  {item.icon === 'Compass' && <Compass className={`w-12 h-12 transition-colors duration-300 ${isSelected ? 'text-white' : 'text-white/40'}`} />}
                </div>
              ) : (
                <div className="w-full h-full relative group bg-white/5 backdrop-blur-2xl flex items-center justify-center shadow-inner border border-white/10">
                  {/* @ts-ignore */}
                  {((item as any).wallpaper && (item as any).wallpaper.startsWith('http')) ? (
                    <img 
                      src={(item as any).wallpaper} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getIcon((item as any).icon, isSelected)
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
