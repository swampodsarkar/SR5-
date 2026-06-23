import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gamepad, 
  Wifi, 
  Check, 
  X, 
  RefreshCw, 
  Power, 
  Volume2, 
  VolumeX, 
  Smartphone,
  ChevronRight,
  Shield,
  Vibrate
} from "lucide-react";
import { rtdb } from "../lib/firebase";
import { ref, set, onValue, off } from "firebase/database";

export function GamepadController() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const codeParam = searchParams.get("code") || "";

  const [code, setCode] = useState(codeParam.toUpperCase());
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [pressedButtons, setPressedButtons] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibEnabled, setVibEnabled] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);

  // Audio Context for mechanical clicking sound
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // If the URL has a code, automatically try to connect
    if (codeParam) {
      handleConnect(codeParam.toUpperCase());
    }
  }, [codeParam]);

  const playClickSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  const handleConnect = (targetCode: string) => {
    if (!targetCode || targetCode.length !== 6) return;
    setConnectionStatus("connecting");
    setCode(targetCode.toUpperCase());

    // Setup RTDB connection status node
    const connectedRef = ref(rtdb, `controllers/${targetCode.toUpperCase()}/connected`);
    const stateRef = ref(rtdb, `controllers/${targetCode.toUpperCase()}/state`);

    // Forcefully reset any dirty old pressed state
    set(stateRef, {
      UP: "up",
      DOWN: "up",
      LEFT: "up",
      RIGHT: "up",
      A: "up",
      B: "up",
      X: "up",
      Y: "up",
      SELECT: "up",
      START: "up",
      L1: "up",
      R1: "up",
      lastUpdated: Date.now()
    }).then(() => {
      // Mark as connected
      set(connectedRef, true);
      setConnectionStatus("connected");

      // Measure latency dynamically
      const pingRef = ref(rtdb, `controllers/${targetCode.toUpperCase()}/ping`);
      const interval = setInterval(() => {
        const start = Date.now();
        set(pingRef, start).then(() => {
          setLatency(Date.now() - start);
        });
      }, 5000);

      // Save to clean up
      (window as any)._cleanupInterval = interval;
    }).catch((err) => {
      console.error(err);
      setConnectionStatus("disconnected");
    });
  };

  const handleDisconnect = () => {
    if (code) {
      // Clear connected state in DB
      set(ref(rtdb, `controllers/${code}/connected`), null);
      set(ref(rtdb, `controllers/${code}/state`), null);
    }
    if ((window as any)._cleanupInterval) {
      clearInterval((window as any)._cleanupInterval);
    }
    setConnectionStatus("disconnected");
    setLatency(null);
    setPressedButtons({});
    navigate("/controller");
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if ((window as any)._cleanupInterval) {
        clearInterval((window as any)._cleanupInterval);
      }
    };
  }, []);

  const handleButtonPress = async (btn: string) => {
    if (connectionStatus !== "connected") return;
    
    // Trigger vibration feedback
    if (vibEnabled && navigator.vibrate) {
      navigator.vibrate(30);
    }
    
    playClickSound();
    setPressedButtons(prev => ({ ...prev, [btn]: true }));

    try {
      await set(ref(rtdb, `controllers/${code}/state/${btn}`), "down");
      await set(ref(rtdb, `controllers/${code}/state/lastUpdated`), Date.now());
    } catch (e) {
      console.error(e);
    }
  };

  const handleButtonRelease = async (btn: string) => {
    if (connectionStatus !== "connected") return;
    setPressedButtons(prev => ({ ...prev, [btn]: false }));

    try {
      await set(ref(rtdb, `controllers/${code}/state/${btn}`), "up");
      await set(ref(rtdb, `controllers/${code}/state/lastUpdated`), Date.now());
    } catch (e) {
      console.error(e);
    }
  };

  // Safe helper to combine pointer down and touch boundaries
  const touchProps = (btn: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      handleButtonPress(btn);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      handleButtonRelease(btn);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      e.preventDefault();
      handleButtonRelease(btn);
    }
  });

  return (
    <div className="fixed inset-0 bg-[#07070a] text-white flex flex-col justify-between items-center select-none overflow-hidden font-sans">
      
      {/* BACKGROUND GRAPHIC ACCENTS */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#111119] to-transparent pointer-events-none" />
      <div className="absolute -left-32 -top-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* RENDER VIEW 1: PAIRING DISCONNECTED LAYOUT */}
      {connectionStatus !== "connected" && (
        <div className="flex-1 w-full max-w-md px-6 flex flex-col justify-center z-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-cyan-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl">
              <Gamepad className="w-8 h-8 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-zinc-500">
                SR5 Remote Gamepad
              </h1>
              <p className="text-xs text-white/50 tracking-wide mt-1 font-mono">
                NET_PROTOCOL // LOCALHOST_LINK_v1.0
              </p>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* Retro CRT grid lines overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none" />
            
            <span className="text-[10px] text-indigo-400 font-mono font-black uppercase tracking-widest block mb-4 border-b border-indigo-500/20 pb-2">
              CONSOLE LINK TERMINAL
            </span>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-white/40 uppercase block font-bold tracking-wider mb-1.5 font-mono">
                  ENTER 6-DIGIT SYNC CODE
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SR5..."
                    className="bg-black/80 border border-white/10 text-xl text-center py-3.5 px-4 rounded-xl w-full font-mono tracking-widest text-[#00ffcc] uppercase focus:outline-none focus:border-[#00ffcc]/40 focus:ring-1 focus:ring-[#00ffcc]/20 shadow-inner"
                  />
                  {connectionStatus === "connecting" && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleConnect(code)}
                disabled={code.length !== 6 || connectionStatus === "connecting"}
                className="w-full bg-[#00ffcc] hover:bg-[#00e2b3] disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all shadow-md shadow-[#00ffcc]/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Assemble Connection <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 text-center text-xxs text-white/30 leading-relaxed font-mono flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-white/20" />
              <span>Real-time encrypted peer socket link</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xxs text-white/20 leading-relaxed max-w-xs mx-auto">
              Open the SR5 Console on your screen and display the Gamepad pairing code to connect or scan its QR code directly.
            </p>
          </div>
        </div>
      )}

      {/* RENDER VIEW 2: ACTIVE CONTROLLER LAYOUT */}
      {connectionStatus === "connected" && (
        <div className="flex-1 w-full flex flex-col justify-between p-4 z-10 max-w-4xl relative">
          
          {/* HEADER OPTIONS PANEL */}
          <div className="flex items-center justify-between bg-zinc-950/90 border border-white/5 py-2.5 px-4 rounded-2xl shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              <div className="leading-none">
                <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono block">
                  PEER_SYNCED
                </span>
                <span className="text-[9px] text-white/40 font-mono tracking-wider uppercase mt-0.5 block">
                  CODE: {code} • {latency !== null ? `${latency}ms` : "OK"}
                </span>
              </div>
            </div>

            {/* Tactical hardware Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg transition-colors border ${
                  soundEnabled 
                    ? "bg-white/5 border-white/10 text-[#00ffcc]" 
                    : "bg-red-950/20 border-red-500/10 text-red-500/50"
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setVibEnabled(!vibEnabled)}
                className={`p-2 rounded-lg transition-colors border ${
                  vibEnabled 
                    ? "bg-white/5 border-white/10 text-[#00ffcc]" 
                    : "bg-red-950/20 border-red-500/10 text-red-500/50"
                }`}
              >
                <Vibrate className="w-4 h-4" />
              </button>
              <button
                onClick={handleDisconnect}
                className="bg-red-600 hover:bg-red-500 p-2 rounded-lg text-white transition-colors cursor-pointer"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DYNAMIC RETRO GAMEPAD GRID CONTAINER */}
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 md:items-center gap-6 py-6 select-none touch-none">
            
            {/* LEFT ROW: GIANT ARCADE D-PAD */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48 bg-zinc-900 rounded-full border-4 border-zinc-950 shadow-[0_15px_45px_rgba(0,0,0,0.8)] flex items-center justify-center">
                {/* Embedded Metallic Dial Face */}
                <div className="absolute inset-4 bg-zinc-950 rounded-full border border-white/5 shadow-inner" />
                <div className="absolute w-2 h-2 bg-zinc-800 rounded-full" /> {/* Center pin */}

                {/* UP ARROW BUTTON */}
                <button
                  {...touchProps("UP")}
                  className={`absolute top-0 inset-x-12 h-14 bg-gradient-to-b rounded-t-xl transition-all flex items-center justify-center uppercase font-black text-xxs font-mono ${
                    pressedButtons["UP"] 
                      ? "from-[#00ffcc]/30 to-[#00ffcc]/10 text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.3)]" 
                      : "from-zinc-800 to-zinc-900 border-t border-white/10 text-white/30"
                  }`}
                >
                  ▲
                </button>

                {/* DOWN ARROW BUTTON */}
                <button
                  {...touchProps("DOWN")}
                  className={`absolute bottom-0 inset-x-12 h-14 bg-gradient-to-t rounded-b-xl transition-all flex items-center justify-center uppercase font-black text-xxs font-mono ${
                    pressedButtons["DOWN"] 
                      ? "from-[#00ffcc]/30 to-[#00ffcc]/10 text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.3)]" 
                      : "from-zinc-800 to-zinc-900 border-b border-white/10 text-white/30"
                  }`}
                >
                  ▼
                </button>

                {/* LEFT ARROW BUTTON */}
                <button
                  {...touchProps("LEFT")}
                  className={`absolute left-0 inset-y-12 w-14 bg-gradient-to-r rounded-l-xl transition-all flex items-center justify-center uppercase font-black text-xxs font-mono ${
                    pressedButtons["LEFT"] 
                      ? "from-[#00ffcc]/30 to-[#00ffcc]/10 text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.3)]" 
                      : "from-zinc-800 to-zinc-900 border-l border-white/10 text-white/30"
                  }`}
                >
                  ◀
                </button>

                {/* RIGHT ARROW BUTTON */}
                <button
                  {...touchProps("RIGHT")}
                  className={`absolute right-0 inset-y-12 w-14 bg-gradient-to-l rounded-r-xl transition-all flex items-center justify-center uppercase font-black text-xxs font-mono ${
                    pressedButtons["RIGHT"] 
                      ? "from-[#00ffcc]/30 to-[#00ffcc]/10 text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.3)]" 
                      : "from-zinc-800 to-zinc-900 border-r border-white/10 text-white/30"
                  }`}
                >
                  ▶
                </button>
              </div>
            </div>

            {/* RIGHT ROW: BIG PRIMARY CO-OP ACTION BUTTONS */}
            <div className="flex flex-col items-center justify-center gap-6">
              {/* L1 & R1 SHOULDER WRAPPERS */}
              <div className="flex w-full max-w-sm gap-4">
                <button
                  {...touchProps("L1")}
                  className={`flex-1 py-3 bg-gradient-to-b rounded-xl border border-white/5 text-xxs font-mono font-extrabold uppercase transition-all tracking-wider ${
                    pressedButtons["L1"]
                      ? "bg-indigo-600 text-white scale-95 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      : "bg-zinc-900 text-white/40"
                  }`}
                >
                  TRIGGER L1
                </button>
                <button
                  {...touchProps("R1")}
                  className={`flex-1 py-3 bg-gradient-to-b rounded-xl border border-white/5 text-xxs font-mono font-extrabold uppercase transition-all tracking-wider ${
                    pressedButtons["R1"]
                      ? "bg-indigo-600 text-white scale-95 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      : "bg-zinc-900 text-white/40"
                  }`}
                >
                  TRIGGER R1
                </button>
              </div>

              {/* ACTION ROUNDED BUTTONS (X, Y, A, B) */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Secondary diagonal grid housing */}
                <div className="absolute inset-0 bg-zinc-950/40 rounded-full border border-white/5 pointer-events-none" />

                {/* Y BUTTON (Top Left position) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <button
                    {...touchProps("Y")}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black tracking-tighter uppercase transition-transform active:scale-90 border-2 ${
                      pressedButtons["Y"]
                        ? "bg-emerald-500 border-emerald-300 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-900 border-zinc-750 text-emerald-400"
                    }`}
                  >
                    Y
                  </button>
                </div>

                {/* X BUTTON */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                  <button
                    {...touchProps("X")}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black tracking-tighter uppercase transition-transform active:scale-90 border-2 ${
                      pressedButtons["X"]
                        ? "bg-blue-500 border-blue-300 text-black shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                        : "bg-zinc-900 border-zinc-750 text-blue-400"
                    }`}
                  >
                    X
                  </button>
                </div>

                {/* B BUTTON (Left position) */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                  <button
                    {...touchProps("B")}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black tracking-tighter uppercase transition-transform active:scale-90 border-2 ${
                      pressedButtons["B"]
                        ? "bg-yellow-500 border-yellow-300 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                        : "bg-zinc-900 border-zinc-750 text-yellow-400"
                    }`}
                  >
                    B
                  </button>
                </div>

                {/* A BUTTON (Bottom position) */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <button
                    {...touchProps("A")}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black tracking-tighter uppercase transition-transform active:scale-90 border-2 ${
                      pressedButtons["A"]
                        ? "bg-red-500 border-red-300 text-black shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "bg-zinc-900 border-zinc-750 text-red-400"
                    }`}
                  >
                    A
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* LOWER CENTER PILLS: SELECT & START */}
          <div className="flex items-center justify-center gap-8 bg-zinc-950/60 border border-white/5 p-4 rounded-2xl max-w-sm mx-auto w-full backdrop-blur-md">
            <div className="flex flex-col items-center gap-1">
              <button
                {...touchProps("SELECT")}
                className={`w-16 h-6 rounded-full bg-gradient-to-b transition-all border border-white/5 ${
                  pressedButtons["SELECT"]
                    ? "from-slate-300 to-slate-400 scale-95 shadow-inner"
                    : "from-zinc-800 to-zinc-900"
                }`}
              />
              <span className="text-[9px] text-white/40 font-mono font-bold tracking-widest uppercase">
                SELECT
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button
                {...touchProps("START")}
                className={`w-16 h-6 rounded-full bg-gradient-to-b transition-all border border-white/5 ${
                  pressedButtons["START"]
                    ? "from-slate-300 to-slate-400 scale-95 shadow-inner"
                    : "from-zinc-800 to-zinc-900"
                }`}
              />
              <span className="text-[9px] text-white/40 font-mono font-bold tracking-widest uppercase">
                START
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
