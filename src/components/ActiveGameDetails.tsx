import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "../store/uiStore";
import { SystemApps } from "../data/games";
import { useAudio } from "../hooks/useAudio";

export function ActiveGameDetails() {
  const { activeGameId, playGame, gamesList } = useUIStore();
  const { playSelectSound } = useAudio();
  const allItems = [...SystemApps.map(s => ({ ...s, isSystem: true })), ...gamesList];
  const activeItem = allItems.find(i => i.id === activeGameId) as any;

  if (!activeItem) return null;

  const handlePlay = () => {
    playSelectSound();
    if (activeItem.id === "store") {
      useUIStore.getState().setStoreOpen(true);
    } else if (activeItem.id === "explore") {
      useUIStore.getState().setProfileOpen(true);
    } else if (activeItem.core) {
      playGame(activeItem.core, activeItem.romUrl || undefined);
    }
  };

  const buttonText = activeItem.id === "store" 
    ? "Open Store" 
    : activeItem.id === "explore" 
      ? "Open Profile" 
      : "Play Core";

  return (
    <div className="absolute bottom-[20vh] left-12 max-w-2xl pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeItem.id}
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {activeItem.subtitle && (
            <h3 className="text-white/60 font-medium tracking-widest uppercase text-sm mb-2 drop-shadow-md">
              {activeItem.subtitle}
            </h3>
          )}
          <h1 className="text-5xl font-light text-white tracking-tight drop-shadow-2xl mb-8">
            {activeItem.title}
          </h1>

          <div className="flex gap-4">
            <motion.button 
              className="bg-white text-black px-8 py-3 rounded-full font-medium tracking-wide shadow-xl pointer-events-auto hover:scale-105 active:scale-95 transition-transform"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlay}
            >
              {buttonText}
            </motion.button>
            
            {!activeItem.isSystem && (
              <>
                <label className="cursor-pointer bg-black/30 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-full font-medium tracking-wide pointer-events-auto hover:bg-black/50 transition-all inline-block hover:scale-105 active:scale-95">
                  Load ROM
                  <input type="file" className="hidden" accept=".zip,.iso,.bin,.rom,.sfc,.smc,.gba,.nds,.nes,.n64,.gen,.md" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeItem.core) {
                      const url = URL.createObjectURL(file);
                      playGame(activeItem.core, url);
                    }
                  }} />
                </label>
                <motion.button 
                  className="bg-black/30 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-full font-medium tracking-wide pointer-events-auto hover:bg-black/50 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  •••
                </motion.button>
              </>
            )}
          </div>

          {!activeItem.isSystem && typeof activeItem.progress === 'number' && (
            <div className="mt-8 bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 inline-block">
              <div className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold">Trophies</div>
              <div className="flex items-center gap-4">
                <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${activeItem.progress}%` }}
                    transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                    className="h-full bg-yellow-400"
                  />
                </div>
                <span className="text-sm text-white font-medium">{activeItem.progress}%</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
