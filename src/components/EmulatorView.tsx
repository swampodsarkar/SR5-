import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gamepad, Wifi, MessageSquarePlus, Sparkles } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { auth, rtdb } from "../lib/firebase";
import { ref, onValue, push } from "firebase/database";
import { useAudio } from "../hooks/useAudio";

export function EmulatorView() {
  const { isPlaying, playingCore, gameUrl, stopPlaying, activeRoomId } = useUIStore();
  const { playSelectSound, playNavigationSound } = useAudio();
  
  const [roomData, setRoomData] = useState<any>(null);
  const [gameChats, setGameChats] = useState<any[]>([]);

  // Watch for active matchmaking and co-op chats while inside emulator
  useEffect(() => {
    if (!isPlaying || !activeRoomId) {
      setRoomData(null);
      setGameChats([]);
      return;
    }

    const unsubRoom = onValue(ref(rtdb, `rooms/${activeRoomId}`), (snap) => {
      if (snap.exists()) {
        setRoomData(snap.val());
      }
    });

    const unsubChats = onValue(ref(rtdb, `rooms/${activeRoomId}/chat`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const arr = Object.keys(data).map(k => ({
          id: k,
          ...data[k]
        })).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Take last 3 callouts to display overlay bubbles on emulator screen
        const recentCallouts = arr.filter(c => c.message && c.message.startsWith("📢"));
        setGameChats(recentCallouts.slice(-3));
      }
    });

    return () => {
      unsubRoom();
      unsubChats();
    };
  }, [isPlaying, activeRoomId]);

  const transmitCallout = async (text: string) => {
    if (!activeRoomId || !auth.currentUser) return;
    playSelectSound();
    try {
      await push(ref(rtdb, `rooms/${activeRoomId}/chat`), {
        senderEmail: auth.currentUser.email?.split('@')[0] || "Player",
        senderUid: auth.currentUser.uid,
        message: `📢 ${text}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[100] bg-black"
        >
          {/* Header Bar panel with action back buttons */}
          <div className="absolute top-6 left-6 z-[110] flex items-center gap-4">
            <button 
              onClick={() => { playNavigationSound(); stopPlaying(); }}
              className="bg-black/50 hover:bg-black/80 text-white backdrop-blur-md px-6 py-3 rounded-full tracking-wider font-bold transition-all flex items-center gap-3 border border-white/20 hover:scale-105 active:scale-95 shadow-2xl cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              Quit Console
            </button>

            {/* Dynamic Real-time Co-op matching widget */}
            {activeRoomId && roomData && (
              <div className="hidden md:flex items-center gap-3.5 bg-zinc-900/80 backdrop-blur-md border border-cyan-500/30 px-5 py-2.5 rounded-full shadow-2xl">
                <div className="flex items-center gap-1.5 font-mono text-cyan-400 font-extrabold animate-pulse">
                  <Wifi className="w-4 h-4" />
                  <span className="text-[10px] tracking-widest leading-none">RETRONET CO-OP</span>
                </div>
                <div className="w-[1px] h-3.5 bg-white/10" />
                <span className="text-xs text-white/50 leading-none truncate max-w-xs">{roomData.roomName}</span>
                <div className="w-[1px] h-3.5 bg-white/10" />
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold leading-none">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping mr-1" />
                  LATENCY: 12ms
                </div>
              </div>
            )}
          </div>

          {/* Quick Callouts Trigger Drawers Panel (Right Bottom Side) */}
          {activeRoomId && roomData && (
            <div className="absolute bottom-6 right-6 z-[110] flex flex-col items-end gap-3.5 pointer-events-none">
              {/* Callouts bubble list */}
              <div className="flex flex-col gap-2 max-w-sm w-full pr-1">
                <AnimatePresence>
                  {gameChats.map((call) => (
                    <motion.div
                      key={call.id}
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                      className="bg-zinc-950/90 border border-cyan-500/40 p-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] self-end pointer-events-auto backdrop-blur-md"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span className="text-[9px] font-mono font-bold text-cyan-300 leading-none">[{call.senderEmail}]</span>
                      </div>
                      <p className="text-xs text-white leading-normal pl-1.5 font-medium">
                        {call.message.replace("📢", "")}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Sender trigger controls */}
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/15 p-2 rounded-2xl pointer-events-auto">
                <div className="p-1 px-2.5 text-[10px] text-zinc-400 font-mono flex items-center gap-1 leading-none">
                  <Gamepad className="w-3.5 h-3.5 text-cyan-400" /> Q-Chat
                </div>
                <button
                  onClick={() => transmitCallout("GG!")}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-cyan-500 hover:text-zinc-950 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                >
                  GG!
                </button>
                <button
                  onClick={() => transmitCallout("Nice move!")}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-cyan-500 hover:text-zinc-950 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                >
                  Nice move!
                </button>
                <button
                  onClick={() => transmitCallout("Need backup!")}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-cyan-500 hover:text-zinc-950 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                >
                  Need backup!
                </button>
              </div>
            </div>
          )}

          {/* Core emulator frame load */}
          <iframe 
            src={`/emulator.html?core=${playingCore || 'nes'}${gameUrl ? `&url=${encodeURIComponent(gameUrl)}` : ''}`}
            className="w-full h-full border-none" 
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
            allow="gamepad; autoplay; fullscreen"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
