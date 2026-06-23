import { useEffect, useState } from "react";
import { Background } from "../components/Background";
import { TopBar } from "../components/TopBar";
import { GameRow } from "../components/GameRow";
import { ActiveGameDetails } from "../components/ActiveGameDetails";
import { ControlCenter } from "../components/ControlCenter";
import { EmulatorView } from "../components/EmulatorView";
import { SettingsView } from "../components/SettingsView";
import { StoreView } from "../components/StoreView";
import { ProfileView } from "../components/ProfileView";
import { GamepadPairingModal } from "../components/GamepadPairingModal";
import { BootScreen } from "../components/BootScreen";
import { useAudio } from "../hooks/useAudio";
import { useGamepad } from "../hooks/useGamepad";
import { useMobileRemoteController } from "../hooks/useMobileRemoteController";
import { useUIStore } from "../store/uiStore";
import { auth, rtdb } from "../lib/firebase";
import { ref, onChildAdded, limitToLast, query, set } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Bell, Gamepad2, UserPlus, Check, X, Sparkles } from "lucide-react";

export function Home() {
  useMobileRemoteController();
  const { isControlCenterOpen, setControlCenterOpen, isSettingsOpen, isBooting, isBanned, isStoreOpen, isProfileOpen, setActiveRoomId, setProfileOpen } = useUIStore();
  const { playNavigationSound, playSelectSound } = useAudio();
  const [activeNotifications, setActiveNotifications] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Sync Auth User State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (useUIStore.getState().isBooting) return;
      if (e.key === 'p' || e.key === 'P') {
        playNavigationSound();
        setControlCenterOpen(!isControlCenterOpen);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playNavigationSound, isControlCenterOpen, setControlCenterOpen]);

  useGamepad(() => {}, () => {}, () => {
    if (useUIStore.getState().isBooting) return;
    playNavigationSound();
    setControlCenterOpen(!isControlCenterOpen);
  });

  // Subscribe to real-time alerts
  useEffect(() => {
    // 1. Listen to remote dynamic notification blasts pushed from Firebase RTDB in real-time
    const notificationsRef = ref(rtdb, "notifications");
    const notificationsQuery = query(notificationsRef, limitToLast(1));
    
    let isInitialLoad = true;
    const unsubSystem = onChildAdded(notificationsQuery, (snap) => {
      if (isInitialLoad) {
        // Skip historical entries on initial boot
        isInitialLoad = false;
        return;
      }
      
      if (snap.exists()) {
        const notif = snap.val();
        if (notif.message) {
          const id = snap.key || Math.random().toString();
          const newNotif = {
            id,
            type: 'system',
            title: 'SYSTEM BROADCAST',
            message: notif.message,
            timestamp: new Date().toISOString()
          };
          setActiveNotifications(prev => [...prev, newNotif]);
          playNavigationSound();
          
          // Auto dismiss system announcements after 10s
          setTimeout(() => {
            setActiveNotifications(prev => prev.filter(n => n.id !== id));
          }, 10000);
        }
      }
    });

    return () => unsubSystem();
  }, [playNavigationSound]);

  // Synchronize incoming friend requests and room invites
  useEffect(() => {
    if (!currentUser) {
      setActiveNotifications([]);
      return;
    }

    // 2. Listen for incoming pending friend requests
    let initialFriendLoad = true;
    const friendReqRef = ref(rtdb, `friend_requests/${currentUser.uid}`);
    const unsubFriend = onChildAdded(friendReqRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.status === 'pending') {
          const id = `friend_${snap.key}`;
          
          setActiveNotifications(prev => {
            if (prev.some(n => n.id === id)) return prev;
            
            if (!initialFriendLoad) {
              playNavigationSound();
            }
            
            return [...prev, {
              id,
              type: 'friend_request',
              title: 'FRIEND REQUEST',
              message: `${data.senderEmail} wants to connect and build room cards with you!`,
              senderUid: snap.key,
              senderEmail: data.senderEmail,
              timestamp: data.timestamp || new Date().toISOString()
            }];
          });
        }
      }
    });

    const timerFriend = setTimeout(() => {
      initialFriendLoad = false;
    }, 1200);

    // 3. Listen for co-op multiplayer room invites
    let initialInviteLoad = true;
    const roomInvRef = ref(rtdb, `room_invites/${currentUser.uid}`);
    const unsubInvite = onChildAdded(roomInvRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const id = `invite_${snap.key}`;
        
        setActiveNotifications(prev => {
          if (prev.some(n => n.id === id)) return prev;
          
          if (!initialInviteLoad) {
            playNavigationSound();
          }
          
          return [...prev, {
            id,
            type: 'room_invite',
            title: 'CO-OP PARTY INVITE',
            message: `${data.hostEmail} invited you to play "${data.gameTitle}" together inside room "${data.roomName}"!`,
            roomId: data.roomId,
            roomInvId: snap.key,
            timestamp: data.timestamp || new Date().toISOString(),
            gameTitle: data.gameTitle
          }];
        });
      }
    });

    const timerInvite = setTimeout(() => {
      initialInviteLoad = false;
    }, 1200);

    return () => {
      unsubFriend();
      unsubInvite();
      clearTimeout(timerFriend);
      clearTimeout(timerInvite);
    };
  }, [currentUser, playNavigationSound]);

  // Actions dispatcher from notifications
  const handleAcceptFriend = async (notif: any) => {
    if (!currentUser) return;
    playSelectSound();
    try {
      await set(ref(rtdb, `friends/${currentUser.uid}/${notif.senderUid}`), {
        uid: notif.senderUid,
        email: notif.senderEmail,
        timestamp: new Date().toISOString()
      });
      await set(ref(rtdb, `friends/${notif.senderUid}/${currentUser.uid}`), {
        uid: currentUser.uid,
        email: currentUser.email,
        timestamp: new Date().toISOString()
      });
      await set(ref(rtdb, `friend_requests/${currentUser.uid}/${notif.senderUid}`), null);
      setActiveNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineFriend = async (notif: any) => {
    if (!currentUser) return;
    playSelectSound();
    try {
      await set(ref(rtdb, `friend_requests/${currentUser.uid}/${notif.senderUid}`), null);
      setActiveNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptInvite = async (notif: any) => {
    if (!currentUser) return;
    playSelectSound();
    try {
      await set(ref(rtdb, `rooms/${notif.roomId}/players/${currentUser.uid}`), {
        email: currentUser.email,
        uid: currentUser.uid,
        role: 'guest',
        joinedAt: new Date().toISOString()
      });
      await set(ref(rtdb, `room_invites/${currentUser.uid}/${notif.roomInvId}`), null);
      
      setActiveRoomId(notif.roomId);
      setProfileOpen(true);
      setActiveNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineInvite = async (notif: any) => {
    if (!currentUser) return;
    playSelectSound();
    try {
      await set(ref(rtdb, `room_invites/${currentUser.uid}/${notif.roomInvId}`), null);
      setActiveNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (e) {
      console.error(e);
    }
  };

  // Secure locked Banned screen gate
  if (isBanned) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col justify-center items-center text-center p-8 z-[99999] relative text-white">
        <div className="max-w-md space-y-6">
          <div className="bg-red-600/20 text-red-500 border border-red-500/30 p-4 rounded-3xl inline-block">
            <Shield className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-red-500 font-mono">CONSOLE SUSPENDED</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            This client console profile card has been globally suspended by the network administrator due to rule violations. Please contact <strong className="text-white">mdswampodsarkar@gmail.com</strong> for appeals.
          </p>
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl font-mono text-xs text-white/50 space-y-2">
            <div>CONSL_LOCK_CODE: RETRO_BAN_GUARD</div>
            <div>ADMIN_EMAIL: mdswampodsarkar@gmail.com</div>
          </div>
          <button 
            onClick={async () => {
              playSelectSound();
              await auth.signOut();
              useUIStore.getState().setBanned(false);
            }} 
            className="bg-white hover:bg-neutral-200 text-black px-6 py-2.5 rounded-full text-xs font-semibold hover:scale-105 active:scale-95 transition-all"
          >
            Sign Out of Suspect Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden text-white font-sans selection:bg-white/30">
      <BootScreen />
      <Background />
      <TopBar />
      
      {/* High Fidelity Dynamic Notification Popup Stack (Top-Right Panel) */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-4 max-w-md w-full pointer-events-none">
        <AnimatePresence>
          {activeNotifications.map((notif) => {
            const isSystem = notif.type === 'system';
            const isFriend = notif.type === 'friend_request';
            const isInvite = notif.type === 'room_invite';

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, scale: 0.9, x: 50, y: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, x: 100, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="pointer-events-auto w-full bg-zinc-900/90 hover:bg-zinc-900 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.6)] flex items-start gap-4 hover:border-white/20 transition-all relative overflow-hidden"
              >
                {/* Glowing Background Radial Highlights */}
                <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-2xl opacity-10 pointer-events-none ${
                  isSystem ? "bg-amber-500" : isFriend ? "bg-indigo-500" : "bg-cyan-500"
                }`} />

                {/* Left Side SVG custom graphic decoration */}
                <div className="shrink-0">
                  {isSystem && (
                    <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-400">
                      <Bell className="w-5 h-5 animate-pulse" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-zinc-900 animate-ping" />
                    </div>
                  )}
                  {isFriend && (
                    <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-400">
                      <UserPlus className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-zinc-900 animate-pulse" />
                    </div>
                  )}
                  {isInvite && (
                    <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-400">
                      <Gamepad2 className="w-5 h-5 animate-bounce" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-zinc-900 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Text Body contents */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className={`w-3 h-3 ${isSystem ? "text-amber-400" : isFriend ? "text-indigo-400" : "text-cyan-450"}`} />
                    <span className="text-[10px] text-white/50 font-mono font-bold uppercase tracking-wider">{notif.title}</span>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed font-medium">{notif.message}</p>

                  {/* Interactive Option buttons */}
                  {isFriend && (
                    <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleAcceptFriend(notif)}
                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-md cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Connect Player
                      </button>
                      <button
                        onClick={() => handleDeclineFriend(notif)}
                        className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {isInvite && (
                    <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleAcceptInvite(notif)}
                        className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-zinc-950 text-[10px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-lg cursor-pointer animate-pulse"
                      >
                        <Check className="w-3 h-3" /> Join Co-op Party
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(notif)}
                        className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        Ignore
                      </button>
                    </div>
                  )}
                </div>

                {/* Dismiss Close cross */}
                <button
                  onClick={() => setActiveNotifications(prev => prev.filter(n => n.id !== notif.id))}
                  className="absolute top-3.5 right-3.5 p-1 rounded-full text-white/30 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      <main className={`relative w-full h-full transition-all duration-300 ${(isControlCenterOpen || isSettingsOpen || isStoreOpen || isProfileOpen) ? 'scale-95 opacity-50 blur-md pointer-events-none' : 'scale-100'}`}>
        <GameRow />
        <ActiveGameDetails />
      </main>

      <EmulatorView />
      <SettingsView />
      <StoreView />
      <ProfileView />
      <GamepadPairingModal />
      <ControlCenter isOpen={isControlCenterOpen} onClose={() => setControlCenterOpen(false)} />
      
      {/* Helper text */}
      <div className="fixed bottom-4 right-6 text-white/30 text-xs tracking-widest font-mono z-10 pointer-events-none drop-shadow-md">
        PRESS 'P' OR PS BUTTON TO OPEN CONTROL CENTER
      </div>
    </div>
  );
}
