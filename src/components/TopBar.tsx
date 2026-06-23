import { Search, Settings, UserCircle2, Smartphone } from "lucide-react";
import { useEffect } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";

export function TopBar() {
  const { 
    systemTime, 
    updateTime, 
    setSettingsOpen, 
    setProfileOpen,
    isControllerConnected,
    setPairingOpen
  } = useUIStore();
  const { playNavigationSound } = useAudio();

  useEffect(() => {
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, [updateTime]);

  return (
    <div className="absolute top-0 left-0 w-full px-12 py-8 flex justify-between items-start z-50 pointer-events-none">
      {/* Category Nav - SR5 Style */}
      <div className="flex gap-8 text-lg font-medium tracking-wide">
        <button className="pointer-events-auto text-white drop-shadow-md pb-1 border-b-2 border-white/80 font-sans">Games</button>
        <button className="pointer-events-auto text-white/50 hover:text-white transition-colors pb-1 border-b-2 border-transparent font-sans">Media</button>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-6 text-white drop-shadow-md">
        <Smartphone 
          className={`w-[22px] h-[22px] pointer-events-auto cursor-pointer transition-transform hover:scale-110 ${
            isControllerConnected ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-white/60 hover:text-white"
          }`}
          onClick={() => {
            playNavigationSound();
            setPairingOpen(true);
          }}
        />
        <Search className="w-5 h-5 pointer-events-auto cursor-pointer transition-transform hover:scale-110" />
        <Settings className="w-5 h-5 pointer-events-auto cursor-pointer transition-transform hover:scale-110" onClick={() => { playNavigationSound(); setSettingsOpen(true); }} />
        <UserCircle2 className="w-6 h-6 pointer-events-auto cursor-pointer transition-transform hover:scale-110" onClick={() => { playNavigationSound(); setProfileOpen(true); }} />
        <span className="text-xl font-medium tracking-wider ml-2 font-mono">{systemTime}</span>
      </div>
    </div>
  );
}
