import { useNavigate } from "react-router-dom";
import { Gamepad2, Sparkles, MonitorPlay, Zap, ArrowRight, Shield, Cpu } from "lucide-react";

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#07070a] text-white flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-widest font-mono">SR5 CONSOLE</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center text-center px-4 -mt-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-cyan-400">
          <Sparkles className="w-4 h-4" />
          <span>NEXT GENERATION WEB EMULATION</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black capitalize tracking-tight max-w-4xl mb-6">
          The Ultimate Retro <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Gaming Experience</span>
        </h1>

        <p className="text-lg text-white/60 max-w-2xl mb-12">
          Experience classic gaming like never before. SR5 brings a stunning UI, seamless multiplayer, and a robust emulator core directly into your browser. No downloads required.
        </p>

        <button 
          onClick={() => navigate('/console')}
          className="group relative px-8 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          <span>Launch SR5 Console</span>
          <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Feature Highlights */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full text-left">
          <div className="p-6 rounded-3xl bg-neutral-900 border border-white/5 relative overflow-hidden">
            <MonitorPlay className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Immersive UI</h3>
            <p className="text-sm text-white/50">A console-like experience with sound effects, animations, and a seamless controller-friendly interface.</p>
          </div>
          <div className="p-6 rounded-3xl bg-neutral-900 border border-white/5 relative overflow-hidden">
            <Zap className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Native Performance</h3>
            <p className="text-sm text-white/50">Powered by WebAssembly cores ensuring full frame rates with low latency controller support.</p>
          </div>
          <div className="p-6 rounded-3xl bg-neutral-900 border border-white/5 relative overflow-hidden">
             <Cpu className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Multiplayer Co-Op</h3>
            <p className="text-sm text-white/50">Join friends in real-time synced sessions or use a smartphone as a second virtual gamepad.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
