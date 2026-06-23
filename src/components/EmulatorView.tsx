import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gamepad, Wifi, MessageSquarePlus, Sparkles, Eye, Clock, Coins } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { auth, rtdb } from "../lib/firebase";
import { ref, onValue, push, get, update } from "firebase/database";
import { useAudio } from "../hooks/useAudio";
import { trackGamePlay, checkRental, extendRentalWithAd, watchAdForCoins, checkParentalLimit } from "../hooks/useGameSession";

export function EmulatorView() {
  const { isPlaying, playingCore, gameUrl, stopPlaying, activeRoomId, activeGameId, gamePlayStart, gamePlayStop } = useUIStore();
  const { playSelectSound, playNavigationSound } = useAudio();
  const timerRef = useRef<any>(null);
  const [rentalStatus, setRentalStatus] = useState<'owned' | 'rented_valid' | 'rented_expired' | 'none' | 'checking'>('checking');
  const [showAdWall, setShowAdWall] = useState(false);
  const [parentalBlocked, setParentalBlocked] = useState(false);
  const [parentalDaily, setParentalDaily] = useState(0);
  const [parentalMax, setParentalMax] = useState(999);
  const [adCooldown, setAdCooldown] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  
  const [roomData, setRoomData] = useState<any>(null);
  const [gameChats, setGameChats] = useState<any[]>([]);

  // Game session tracking
  useEffect(() => {
    if (!isPlaying || !activeGameId) return;

    let cancelled = false;

    checkRental(activeGameId).then((status) => {
      if (cancelled) return;
      setRentalStatus(status);
      if (status === 'rented_expired') {
        setShowAdWall(true);
        return;
      }
      // Only start session if rental is valid
      gamePlayStart(activeGameId);
      timerRef.current = setInterval(() => {
        setSessionMinutes((p) => p + 1);
      }, 60000);
    });

    // Check parental controls
    if (auth.currentUser) {
      checkParentalLimit(auth.currentUser.uid).then((res) => {
        if (cancelled) return;
        setParentalDaily(res.dailyMinutes);
        setParentalMax(res.maxMinutes);
        if (res.blocked) setParentalBlocked(true);
      });
    }

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      const mins = gamePlayStop();
      if (mins > 0) {
        trackGamePlay(activeGameId, mins);
        // Analytics handled inside trackGamePlay
      }
    };
  }, [isPlaying, activeGameId]);

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

          {/* Rental expired / Ad-wall overlay */}
          {showAdWall && (
            <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-6">
                <Clock className="w-16 h-16 text-amber-400 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Game Time Expired</h2>
                <p className="text-white/60 text-sm">Your rental period for this game has ended. Watch a short ad to get 1 more hour of play time, or purchase the full game.</p>
                <div className="flex flex-col gap-3 pt-2">
                  <button onClick={async () => {
                    setAdCooldown(true);
                    if (activeGameId && await extendRentalWithAd(activeGameId)) {
                      setShowAdWall(false); setRentalStatus('rented_valid');
                    }
                    setAdCooldown(false);
                  }} disabled={adCooldown} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-full text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                    {adCooldown ? 'Loading...' : <>🎬 Watch Ad (1hr unlock)</>}
                  </button>
                  <button onClick={() => { playNavigationSound(); stopPlaying(); }} className="text-white/50 hover:text-white text-xs transition-colors cursor-pointer">
                    Back to Console
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Parental control block overlay */}
          {parentalBlocked && (
            <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-6">
                <Eye className="w-16 h-16 text-indigo-400 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Daily Play Limit Reached</h2>
                <p className="text-white/60 text-sm">You've used {parentalDaily} of {parentalMax} minutes today. Parental controls are active.</p>
                <button onClick={() => { playNavigationSound(); stopPlaying(); }} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-8 py-3 rounded-full text-sm cursor-pointer">
                  Back to Console
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
