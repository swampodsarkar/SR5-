import { useUIStore } from "../store/uiStore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Smartphone, 
  Wifi, 
  Copy, 
  Check, 
  Radio, 
  Zap, 
  BookOpen, 
  Gamepad2
} from "lucide-react";
import { useState } from "react";
import { useAudio } from "../hooks/useAudio";

export function GamepadPairingModal() {
  const { 
    isPairingOpen, 
    setPairingOpen, 
    controllerCode, 
    controllerCodeP2,
    isControllerConnected,
    isControllerConnectedP2
  } = useUIStore();

  const { playSelectSound, playNavigationSound } = useAudio();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<1|2>(1);

  // Derive the active controller URL
  const currentCode = activeTab === 1 ? controllerCode : controllerCodeP2;
  const currentConnected = activeTab === 1 ? isControllerConnected : isControllerConnectedP2;

  const controllerUrl = `${window.location.origin}/controller?code=${currentCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=07070a&bgcolor=ffffff&data=${encodeURIComponent(controllerUrl)}`;

  const handleCopyLink = () => {
    playSelectSound();
    navigator.clipboard.writeText(controllerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isPairingOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* Backdrop glass overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { playNavigationSound(); setPairingOpen(false); }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Solid Card Frame */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-[#0b0c10] border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 relative"
        >
          {/* Neon Top Frame Border */}
          <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400" />

          {/* Close Action Trigger */}
          <button
            onClick={() => { playNavigationSound(); setPairingOpen(false); }}
            className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content Wrapper */}
          <div className="p-8 pb-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                <Gamepad2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  Link Mobile Gamepad
                </h3>
                <p className="text-xxs text-white/40 font-mono tracking-widest uppercase mt-0.5">
                  NET_LINK_SERVICE // CO-OP MODULAR
                </p>
              </div>
            </div>

            {/* PLAYER TABS */}
            <div className="flex gap-2">
               <button 
                  onClick={() => { playSelectSound(); setActiveTab(1); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-colors border ${activeTab === 1 ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
               >
                  Player 1 {isControllerConnected && " (Connected)"}
               </button>
               <button 
                  onClick={() => { playSelectSound(); setActiveTab(2); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-colors border ${activeTab === 2 ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
               >
                  Player 2 {isControllerConnectedP2 && " (Connected)"}
               </button>
            </div>

            {/* DYNAMIC RETRO-STYLE PAIRING CORE DISPLAY */}
            {currentConnected ? (
              /* IF CONTROLLER CONNECTED: SUCCESS CORE STATE */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`${activeTab === 1 ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-purple-500/10 border-purple-500/30'} border p-8 rounded-2xl text-center space-y-4 shadow-xl`}
              >
                <div className={`w-16 h-16 ${activeTab === 1 ? 'bg-cyan-500/20 border-cyan-400/30' : 'bg-purple-500/20 border-purple-400/30'} border rounded-full flex items-center justify-center mx-auto shadow-inner`}>
                  <Wifi className={`w-8 h-8 ${activeTab === 1 ? 'text-cyan-400' : 'text-purple-400'} animate-bounce`} />
                </div>
                <div className="space-y-1">
                  <h4 className={`text-sm font-bold ${activeTab === 1 ? 'text-cyan-400' : 'text-purple-400'} uppercase tracking-widest font-mono`}>
                    P{activeTab} LINK ACTIVE
                  </h4>
                  <p className="text-xs text-white/70">
                    Controller sync established successfully. You can now use this controller in co-op games!
                  </p>
                </div>
                
                <div className="flex justify-center items-center gap-6 pt-2 font-mono">
                  <div className="text-center">
                    <span className="text-[10px] text-white/40 block">LATENCY</span>
                    <span className="text-xs font-bold text-white">12ms</span>
                  </div>
                  <div className="w-[1px] h-6 bg-white/10" />
                  <div className="text-center">
                    <span className="text-[10px] text-white/40 block">SLOT_ASSIGN</span>
                    <span className="text-xs font-bold text-white">PLAYER_{activeTab}_GP</span>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => { playNavigationSound(); setPairingOpen(false); }}
                    className={`${activeTab === 1 ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-purple-500 hover:bg-purple-400'} text-black font-extrabold text-xs px-6 py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow-md`}
                  >
                    Return to system
                  </button>
                </div>
              </motion.div>
            ) : (
              /* IF DISCONNECTED: DISPLAY QR CODE AND CODE INPUT DETAILS */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Left Column: QR Code Display Frame */}
                  <div className="md:col-span-6 flex flex-col items-center">
                    <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-white/10 hover:rotate-1 transition-transform duration-300">
                      <img 
                        src={qrCodeUrl} 
                        alt="Gamepad Controller QR Sync Link" 
                        className="w-36 h-36 border-none"
                      />
                    </div>
                    <span className="text-[9px] text-white/30 font-mono uppercase mt-2.5 tracking-wider flex items-center gap-1.5 leading-none">
                      <Zap className="w-3 h-3 text-cyan-400" /> Scan QR to pair instantly
                    </span>
                  </div>

                  {/* Right Column: Connection Details / Code */}
                  <div className="md:col-span-6 space-y-4">
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-inner">
                      <span className="text-[9px] text-white/40 font-mono uppercase font-black tracking-widest leading-none">
                        MANUAL SYNC CODE
                      </span>
                      <span className="text-2xl font-black font-mono tracking-widest text-cyan-400 py-1 uppercase select-all">
                        {currentCode.slice(0,3)} {currentCode.slice(3)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] text-white/40 font-mono uppercase font-black tracking-wider leading-none block">
                        WEB CONTROLLER LINK
                      </span>
                      <div className="flex bg-black/40 border border-white/10 p-2.5 rounded-xl items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-400 font-mono truncate select-all">
                          {window.location.host}/controller
                        </span>
                        <button
                          onClick={handleCopyLink}
                          className="text-white/50 hover:text-cyan-400 transition-all cursor-pointer"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Instruction Steps */}
                <div className="bg-white/[0.02] border border-white/5 p-4.5 rounded-2xl space-y-2.5 font-mono text-xxs">
                  <div className="flex items-center gap-2 text-indigo-400 uppercase font-black tracking-wider">
                    <BookOpen className="w-3.5 h-3.5" /> Linking Quick Guide
                  </div>
                  <ol className="list-decimal pl-4.5 leading-relaxed text-white/60 space-y-1">
                    <li>Open this QR code link on your smartphone's camera.</li>
                    <li>The custom virtual retro controller webapp will load instantly.</li>
                    <li>Once it finishes syncing, this dialog panel will close itself!</li>
                  </ol>
                </div>
              </div>
            )}
            
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
