import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gamepad, Wifi, MessageSquarePlus, Sparkles, Eye, Clock, Coins, Monitor, StopCircle, Smartphone, Copy, Check, X as XIcon } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { auth, rtdb } from "../lib/firebase";
import { ref, onValue, push, get, update, set as dbSet } from "firebase/database";
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

  // Controller pairing in-emulator
  const [showControllerPanel, setShowControllerPanel] = useState(false);
  const [ctrlTab, setCtrlTab] = useState<1|2|3|4>(1);
  const [copied, setCopied] = useState(false);
  const [localIp, setLocalIp] = useState('');

  // Detect local network IP for QR code
  useEffect(() => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(o => pc.setLocalDescription(o));
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate) return;
        const m = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (m && m[1] !== '127.0.0.1') setLocalIp(m[1]);
      };
      setTimeout(() => pc.close(), 2000);
    } catch (e) {}
  }, []);

  const baseUrl = localIp ? `http://${localIp}:3000` : window.location.origin;
  const allCodes = [useUIStore.getState().controllerCode, useUIStore.getState().controllerCodeP2, useUIStore.getState().controllerCodeP3, useUIStore.getState().controllerCodeP4];
  const allConnected = [useUIStore.getState().isControllerConnected, useUIStore.getState().isControllerConnectedP2, useUIStore.getState().isControllerConnectedP3, useUIStore.getState().isControllerConnectedP4];
  const curCode = allCodes[ctrlTab - 1] || allCodes[0];
  const curConnected = allConnected[ctrlTab - 1] || false;
  const ctrlUrl = `${baseUrl}/controller.html?code=${curCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=07070a&bgcolor=ffffff&data=${encodeURIComponent(ctrlUrl)}`;

  // PeerJS streaming
  const [peerJsLoaded, setPeerJsLoaded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingPeerId, setSharingPeerId] = useState('');
  const [isViewingStream, setIsViewingStream] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);
  const shareStreamRef = useRef<MediaStream | null>(null);
  const [joinPeerId, setJoinPeerId] = useState('');

  // Dynamic PeerJS load
  useEffect(() => {
    if ((window as any).Peer) { setPeerJsLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    s.onload = () => setPeerJsLoaded(true);
    document.head.appendChild(s);
  }, []);

  // Monitor room for streamPeerId (guest flow)
  useEffect(() => {
    if (!isPlaying || !activeRoomId || !peerJsLoaded || isSharing) return;
    const sr = ref(rtdb, `rooms/${activeRoomId}/streamPeerId`);
    const unsub = onValue(sr, (snap) => {
      if (!snap.exists() || !snap.val()) return;
      const hostPeerId: string = snap.val();
      if (hostPeerId === 'sharing' || !hostPeerId.startsWith('p_')) return;
      // Guest: connect to host stream
      try {
        const peer = new (window as any).Peer();
        peer.on('open', () => {
          const call = peer.call(hostPeerId, null);
          call.on('stream', (stream: MediaStream) => {
            setRemoteStream(stream);
            setIsViewingStream(true);
          });
          call.on('close', () => { setIsViewingStream(false); setRemoteStream(null); });
        });
        peerRef.current = peer;
      } catch (e) { console.error('PeerJS guest error:', e); }
    });
    return () => { unsub(); if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } };
  }, [isPlaying, activeRoomId, peerJsLoaded, isSharing]);

  // Start screen sharing (host flow)
  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false });
      shareStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => stopSharing();

      const peer = new (window as any).Peer();
      peerRef.current = peer;
      peer.on('open', (id: string) => {
        setSharingPeerId(id);
        if (activeRoomId) {
          dbSet(ref(rtdb, `rooms/${activeRoomId}/streamPeerId`), id);
          setIsSharing(true);
        } else {
          setIsSharing(true);
        }
      });
      peer.on('call', (call: any) => {
        call.answer(stream);
        call.on('close', () => {});
      });
    } catch (e) { console.error('Share failed:', e); }
  };

  const stopSharing = () => {
    if (shareStreamRef.current) { shareStreamRef.current.getTracks().forEach(t => t.stop()); shareStreamRef.current = null; }
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    if (activeRoomId) dbSet(ref(rtdb, `rooms/${activeRoomId}/streamPeerId`), null);
    setIsSharing(false);
  };

  // Cleanup on unmount
  useEffect(() => () => { stopSharing(); }, []);

  // Set video source when remoteStream changes
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Detect stream-only mode (joining a stream without a game)
  const isStreamOnly = gameUrl?.startsWith('stream:');
  const streamPeerIdFromUrl = isStreamOnly ? gameUrl?.replace('stream:', '') : '';

  // Auto-join stream if streamPeerIdFromUrl is set
  useEffect(() => {
    if (!isPlaying || !streamPeerIdFromUrl || !peerJsLoaded) return;
    const pid = streamPeerIdFromUrl.trim();
    if (!pid) return;
    try {
      const peer = new (window as any).Peer();
      peer.on('open', () => {
        const call = peer.call(pid, null);
        call.on('stream', (stream: MediaStream) => { setRemoteStream(stream); setIsViewingStream(true); });
        call.on('close', () => { setIsViewingStream(false); setRemoteStream(null); });
      });
      peerRef.current = peer;
    } catch (e) { console.error('Stream join error:', e); }
  }, [isPlaying, streamPeerIdFromUrl, peerJsLoaded]);

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
          <div className="absolute top-6 left-6 right-6 z-[110] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { playNavigationSound(); stopPlaying(); }}
                className="bg-black/50 hover:bg-black/80 text-white backdrop-blur-md px-6 py-3 rounded-full tracking-wider font-bold transition-all flex items-center gap-3 border border-white/20 hover:scale-105 active:scale-95 shadow-2xl cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                Quit Console
              </button>

              {/* Controller floating button */}
              <button
                onClick={() => { playSelectSound(); setShowControllerPanel(!showControllerPanel); }}
                className={`flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-3 rounded-full border transition-all cursor-pointer ${showControllerPanel ? 'border-cyan-400/50 text-cyan-400' : 'border-white/20 text-white/70 hover:text-white'}`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-wider">CONTROLLER</span>
                {allConnected.some(Boolean) && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
              </button>

              {/* Share Screen - always visible when emulator is open */}
              {!isViewingStream && !isSharing && (
                <button onClick={() => { playSelectSound(); startSharing(); }}
                  className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 backdrop-blur-md px-4 py-3 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer"
                >
                  <Monitor className="w-4 h-4" /> SHARE SCREEN
                </button>
              )}
              {isSharing && (
                <button onClick={() => { playSelectSound(); stopSharing(); }}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 backdrop-blur-md px-4 py-3 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" /> STOP SHARE
                </button>
              )}

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
                  {!isViewingStream && !isSharing && (
                    <button
                      onClick={() => { playSelectSound(); startSharing(); }}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      <Monitor className="w-3 h-3" /> Share Screen
                    </button>
                  )}
                  {isSharing && (
                    <button
                      onClick={() => { playSelectSound(); stopSharing(); }}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-all bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    >
                      <StopCircle className="w-3 h-3" /> Stop Stream
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controller pairing panel (sliding overlay) */}
          <AnimatePresence>
          {showControllerPanel && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute top-24 left-6 z-[120] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 w-72 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold tracking-widest text-white/80 font-mono">PAIR CONTROLLER</h4>
                <button onClick={() => setShowControllerPanel(false)} className="text-white/40 hover:text-white cursor-pointer"><XIcon className="w-4 h-4" /></button>
              </div>

              {/* P1-P4 tabs */}
              <div className="grid grid-cols-4 gap-1 mb-4">
                {[1,2,3,4].map(n => {
                  const colors = ['#06b6d4','#a855f7','#f59e0b','#ef4444'];
                  return (
                    <button key={n} onClick={() => { playSelectSound(); setCtrlTab(n as any); }}
                      className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${ctrlTab === n ? 'text-white border' : 'text-white/40 border border-transparent'}`}
                      style={ctrlTab === n ? { background: colors[n-1] + '20', borderColor: colors[n-1] + '50', color: colors[n-1] } : {}}
                    >P{n} {allConnected[n-1] ? '✓' : ''}</button>
                  );
                })}
              </div>

              {curConnected ? (
                <div className="text-center py-4 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center border-2" style={{ borderColor: ['#06b6d4','#a855f7','#f59e0b','#ef4444'][ctrlTab-1], background: ['#06b6d4','#a855f7','#f59e0b','#ef4444'][ctrlTab-1] + '20' }}>
                    <Wifi className="w-5 h-5" style={{ color: ['#06b6d4','#a855f7','#f59e0b','#ef4444'][ctrlTab-1] }} />
                  </div>
                  <p className="text-xs font-bold font-mono" style={{ color: ['#06b6d4','#a855f7','#f59e0b','#ef4444'][ctrlTab-1] }}>P{ctrlTab} LINKED</p>
                  <p className="text-[10px] text-white/40">Controller connected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <img key={qrUrl} src={qrUrl} alt="QR" className="w-28 h-28 border border-white/5 rounded-xl bg-white p-1" />
                  </div>
                  <div className="text-center">
                    <span className="text-lg font-bold font-mono tracking-widest" style={{ color: ['#06b6d4','#a855f7','#f59e0b','#ef4444'][ctrlTab-1] }}>
                      {curCode.slice(0,3)} {curCode.slice(3)}
                    </span>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(ctrlUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="w-full text-[10px] bg-white/5 border border-white/10 py-2 rounded-xl text-white/60 hover:text-white font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>

          {/* Sharing peer ID display (when sharing outside a room) */}
          {isSharing && sharingPeerId && !activeRoomId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-24 left-6 z-[120] bg-zinc-900/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 w-64 shadow-2xl"
            >
              <p className="text-[10px] text-white/40 font-mono mb-2">SHARING SCREEN — Give this ID:</p>
              <p className="text-lg font-bold font-mono tracking-widest text-emerald-400 text-center select-all">{sharingPeerId}</p>
              <button onClick={() => { navigator.clipboard.writeText(sharingPeerId); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="w-full mt-3 text-[10px] bg-emerald-500/10 border border-emerald-500/30 py-2 rounded-xl text-emerald-400 font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied!' : 'Copy Peer ID'}
              </button>
            </motion.div>
          )}

          {/* Join Stream input (always visible when not sharing/streaming) */}
          {!isSharing && !isViewingStream && (
            <div className="absolute top-24 left-6 z-[120] flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-xl">
              <input value={joinPeerId} onChange={e => setJoinPeerId(e.target.value.toUpperCase())} placeholder="Enter Peer ID to join stream..." className="w-36 bg-transparent text-[10px] text-white font-mono outline-none placeholder:text-white/20" maxLength={50} />
              <button onClick={() => {
                if (!joinPeerId || !peerJsLoaded) return;
                try {
                  const peer = new (window as any).Peer();
                  peer.on('open', () => {
                    const call = peer.call(joinPeerId, null);
                    call.on('stream', (stream: MediaStream) => { setRemoteStream(stream); setIsViewingStream(true); });
                    call.on('close', () => { setIsViewingStream(false); setRemoteStream(null); });
                  });
                  peerRef.current = peer;
                } catch (e) { console.error('Join error:', e); }
              }}
                className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-cyan-500/30 transition-all">JOIN</button>
            </div>
          )}

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

          {/* Guest stream receiver overlay */}
          {isViewingStream && (
            <div className="absolute inset-0 z-[180] bg-black flex flex-col">
              <div className="absolute top-6 left-6 z-10">
                <button onClick={() => { playNavigationSound(); stopPlaying(); }} className="bg-black/50 hover:bg-black/80 text-white backdrop-blur-md px-6 py-3 rounded-full text-xs font-bold flex items-center gap-2 border border-white/20 cursor-pointer">
                  <ArrowLeft className="w-4 h-4" /> Leave Stream
                </button>
              </div>
              <div className="absolute top-6 right-6 z-10 flex items-center gap-2 bg-black/60 text-emerald-400 px-4 py-2 rounded-full text-[10px] font-mono border border-emerald-500/30">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                LIVE STREAM • P2 CONTROLLER ACTIVE
              </div>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            </div>
          )}

          {/* Core emulator frame load - hidden for stream-only or guest viewing */}
          {!isStreamOnly && (
            <iframe 
              src={`/emulator.html?core=${playingCore || 'nes'}${gameUrl ? `&url=${encodeURIComponent(gameUrl)}` : ''}`}
              className={`w-full h-full border-none ${isViewingStream ? 'hidden' : ''}`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
              allow="gamepad; autoplay; fullscreen"
            />
          )}
          {isStreamOnly && !isViewingStream && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-white/50 font-mono">Connecting to stream...</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
