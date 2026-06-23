import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Download, Check, AlertCircle, Coins, Search, Sparkles, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";
import { auth, rtdb } from "../lib/firebase";
import { ref, onValue, set, update, get } from "firebase/database";
import { onAuthStateChanged, User } from "firebase/auth";
import { Game } from "../data/games";

export interface StoreItem {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  core: string;
  icon: string;
  wallpaper: string;
  themeColor: string;
  romUrl: string;
  isCustom?: boolean;
  sizeMb?: number;
}

// Fixed retro store shelfs
const STATIC_STORE_ITEMS: StoreItem[] = [];

export function StoreView() {
  const { isStoreOpen, setStoreOpen, gamesList, setGamesList } = useUIStore();
  const { playSelectSound, playNavigationSound } = useAudio();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Realtime Database Sync
  const [balance, setBalance] = useState<number>(0);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [dbItems, setDbItems] = useState<StoreItem[]>([]);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState<"all" | "library">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Sync user wallet balance and purchases from Firebase Realtime Database
        const balanceRef = ref(rtdb, `users/${user.uid}/balance`);
        onValue(balanceRef, (snap) => {
          if (snap.exists()) {
            setBalance(snap.val());
          } else {
            // First time login - bootstrap $100.00 standard wallet
            set(balanceRef, 100.00);
            setBalance(100.00);
          }
        });

        // Sync purchased list
        const purchaseRef = ref(rtdb, `users/${user.uid}/purchased`);
        onValue(purchaseRef, (snap) => {
          if (snap.exists()) {
            setPurchasedIds(Object.keys(snap.val()));
          } else {
            setPurchasedIds([]);
          }
        });

        // Sync installed list
        const installRef = ref(rtdb, `users/${user.uid}/installed`);
        onValue(installRef, (snap) => {
          if (snap.exists()) {
            setInstalledIds(Object.keys(snap.val()));
          } else {
            setInstalledIds([]);
          }
        });
      } else {
        setBalance(0);
        setPurchasedIds([]);
        setInstalledIds([]);
      }
    });

    // Listen inside /games list to synchronize admin added database games
    const dbGamesRef = ref(rtdb, "games");
    onValue(dbGamesRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const games: StoreItem[] = Object.keys(val).map((id) => ({
          id,
          title: val[id].title || "Unknown Core",
          subtitle: val[id].subtitle || "Direct Admin Upload",
          price: val[id].price !== undefined ? Number(val[id].price) : 0,
          core: val[id].core || "nes",
          icon: val[id].icon || "Gamepad",
          wallpaper: val[id].wallpaper || "linear-gradient(to right bottom, #111111, #434343)",
          themeColor: val[id].themeColor || "#ffffff",
          romUrl: val[id].romUrl || "",
          sizeMb: val[id].sizeMb !== undefined ? Number(val[id].sizeMb) : 5,
          isCustom: true
        }));
        setDbItems(games);
        
        // Let's also synchronize installed custom games back to the console's Main Dashboard gamesList!
        // If current user has installed games, let's load them inside useUIStore's gamesList so users can play them!
      } else {
        setDbItems([]);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Sync installed custom games to store / main Dashboard gamesList in real-time
  useEffect(() => {
    if (!currentUser) return;
    const installRef = ref(rtdb, `users/${currentUser.uid}/installed`);
    onValue(installRef, (snap) => {
      if (snap.exists()) {
        const installedKeys = Object.keys(snap.val());
        // Retrieve dynamic game definitions
        // Merge the static MOckGames with the downloaded dynamic store items!
        const fullStoreCatalog = [...STATIC_STORE_ITEMS, ...dbItems];
        const userInstalledObjects = fullStoreCatalog.filter(item => installedKeys.includes(item.id));
        
        // Convert StoreItem to Game format
        const customGames: Game[] = userInstalledObjects.map(item => ({
          id: item.id,
          title: item.title,
          subtitle: `${item.subtitle} (Installed)`,
          image: item.romUrl, // ROM URI attached!
          wallpaper: item.wallpaper,
          themeColor: item.themeColor,
          progress: 100,
          core: item.core,
          icon: item.icon
        }));

        // Reset game list by loading static ones + newly installed custom ones from the store!
        // We read from package to merge inside Estado
        import("../data/games").then(({ MOckGames }) => {
          // compile list avoiding duplicates
          const merged = [...MOckGames];
          customGames.forEach(cg => {
            if (!merged.some(g => g.id === cg.id)) {
              merged.push(cg);
            }
          });
          setTimeout(() => {
            setGamesList(merged);
          }, 0);
        });
      }
    });
  }, [currentUser, dbItems]);

  const handleBuy = async (item: StoreItem) => {
    playSelectSound();
    if (!currentUser) {
      setErrorMsg("Authentication required! Please click the PROFILE icon in the top right to login first.");
      setTimeout(() => setErrorMsg(""), 4000);
      return;
    }

    if (item.price === 0) {
      handleInstall(item, true);
      return;
    }

    if (balance < item.price) {
      setErrorMsg(`Insufficient wallet balance. You need $${(item.price - balance).toFixed(2)} more!`);
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const confirmBuy = window.confirm(`Buy "${item.title}" for $${item.price.toFixed(2)}?`);
    if (!confirmBuy) return;

    try {
      // Deduct balance and update purchased nodes in Realtime Database in a single update operation
      const updates: Record<string, any> = {};
      updates[`users/${currentUser.uid}/balance`] = Math.max(0, balance - item.price);
      updates[`users/${currentUser.uid}/purchased/${item.id}`] = true;
      
      await update(ref(rtdb), updates);
      setSuccessMsg(`Successfully purchased "${item.title}"!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setErrorMsg(`Purchase error: ${e.message}`);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  const handleInstall = (item: StoreItem, isFreePurchase: boolean = false) => {
    playSelectSound();
    
    if (!currentUser) {
      setErrorMsg("Authentication required to install and play games.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    
    if (downloading[item.id]) return;

    setDownloading(prev => ({ ...prev, [item.id]: 1 }));
    
    // Simulate realistic downloader progress based on game size
    const size = item.sizeMb || 5;
    // Assume roughly ~5MB/s fake connection speed. 250ms tick = 1.25MB downloaded per tick.
    const step = Math.max(1, Math.round((1.25 / size) * 100));

    const timer = setInterval(() => {
      setDownloading(prev => {
        const current = prev[item.id] || 0;
        if (current >= 100) {
          clearInterval(timer);
          
          if (isFreePurchase) {
             const updates: Record<string, any> = {};
             updates[`users/${currentUser?.uid}/purchased/${item.id}`] = true;
             updates[`users/${currentUser?.uid}/installed/${item.id}`] = true;
             update(ref(rtdb), updates).then(() => {
               setSuccessMsg(`"${item.title}" has been added to your Home Dashboard catalog!`);
               setTimeout(() => setSuccessMsg(""), 3000);
             }).catch((err) => {
               setErrorMsg(`Installation failed: ${err.message}`);
               setTimeout(() => setErrorMsg(""), 4000);
             });
          } else {
             // Write installed node to Realtime Database
             set(ref(rtdb, `users/${currentUser?.uid}/installed/${item.id}`), true)
               .then(() => {
                 setSuccessMsg(`"${item.title}" has been added to your Home Dashboard catalog!`);
                 setTimeout(() => setSuccessMsg(""), 3000);
               }).catch((err) => {
                 setErrorMsg(`Installation failed: ${err.message}`);
                 setTimeout(() => setErrorMsg(""), 4000);
               });
          }
          return { ...prev, [item.id]: 0 };
        }
        // Add random slight fluctuation to step
        const randomStep = step + Math.floor(Math.random() * 3) - 1;
        return { ...prev, [item.id]: Math.min(100, current + Math.max(1, randomStep)) };
      });
    }, 250);
  };

  // Merge static ones with Admin-published games in RTDB
  const fullCollection = [...STATIC_STORE_ITEMS, ...dbItems];
  const filteredCollection = fullCollection.filter(item => {
    const s = searchQuery.toLowerCase();
    const matchesSearch = item.title.toLowerCase().includes(s) || item.subtitle.toLowerCase().includes(s) || item.core.toLowerCase().includes(s);
    if (activeTab === "library") {
      return matchesSearch && purchasedIds.includes(item.id);
    }
    return matchesSearch;
  });

  if (!isStoreOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/90 backdrop-blur-3xl text-white select-none">
        
        {/* Particle/Bubble Accent Background */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-blue-900/10 via-purple-900/5 to-transparent pointer-events-none" />

        {/* Top Header */}
        <header className="p-8 px-12 border-b border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-wide flex items-center gap-2">
                SR5 Store
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
              </h1>
              <p className="text-white/40 text-xs font-mono tracking-widest uppercase mt-0.5">Retro Classic Emulator Core Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            {/* Realtime User Balance display */}
            {currentUser ? (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full shadow-inner">
                <Coins className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-[10px] text-white/50 block font-mono font-bold leading-none">WALLET BALANCE</span>
                  <span className="text-lg font-bold font-mono text-amber-300 leading-none">${balance.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs bg-white/5 text-white/50 px-4 py-2.5 rounded-full border border-white/5">
                🔒 Sign in using Profile (top-right) to build your console wallet
              </div>
            )}

            <button 
              onClick={() => { playSelectSound(); setStoreOpen(false); }}
              className="bg-white/5 hover:bg-white/10 transition-all p-3 rounded-full border border-white/10 hover:scale-105 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Alert Notifications Area */}
        <div className="fixed top-28 right-12 z-50 flex flex-col gap-2 max-w-sm">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-red-600/30 backdrop-blur-xl border border-red-500 p-4 rounded-2xl flex gap-3 text-white shadow-2xl shadow-red-500/20"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <div className="text-sm font-medium">{errorMsg}</div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-emerald-600/30 backdrop-blur-xl border border-emerald-500 p-4 rounded-2xl flex gap-3 text-white shadow-2xl shadow-emerald-500/10"
            >
              <Check className="w-5 h-5 shrink-0 text-emerald-400" />
              <div className="text-sm font-medium">{successMsg}</div>
            </motion.div>
          )}
        </div>

        {/* Store body layout */}
        <div className="flex h-[calc(100vh-116px)]">
          
          {/* Side Tabs navigation */}
          <nav className="w-64 border-r border-white/5 p-8 flex flex-col gap-2">
            <button
              onClick={() => { playNavigationSound(); setActiveTab("all"); }}
              className={`w-full py-3.5 px-5 rounded-2xl text-left font-medium transition-all flex items-center justify-between ${activeTab === "all" ? "bg-white text-black shadow-lg" : "text-white/60 hover:bg-white/5"}`}
            >
              <span>Explore Direct Catalog</span>
              <span className="text-xs bg-white/10 text-white rounded px-2 py-0.5">{fullCollection.length}</span>
            </button>

            <button
              onClick={() => { playNavigationSound(); setActiveTab("library"); }}
              className={`w-full py-3.5 px-5 rounded-2xl text-left font-medium transition-all flex items-center justify-between ${activeTab === "library" ? "bg-white text-black shadow-lg" : "text-white/60 hover:bg-white/5"}`}
            >
              <span>My Owned Items</span>
              <span className="text-xs bg-white/10 text-white rounded px-2 py-0.5">{purchasedIds.length}</span>
            </button>

            <div className="mt-auto p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-white/40 flex flex-col gap-2">
              <span className="font-semibold text-white/60 uppercase tracking-widest font-mono text-[10px]">CORES AVAILABLE</span>
              <span>NES, GBA, SNES, N64, Sega Genesis, NDS, GB, PSX, Atari2600, GameGear and more!</span>
            </div>
          </nav>

          {/* Main Grid View */}
          <main className="flex-1 p-12 overflow-y-auto">
            
            {/* Search and Filters */}
            <div className="flex gap-4 mb-8">
              <div className="flex-1 relative bg-white/5 rounded-2xl border border-white/5 overflow-hidden flex items-center px-4 hover:border-white/15 transition-all">
                <Search className="w-5 h-5 text-white/30" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search retro core packages, system ports, or catalog games..."
                  className="flex-1 bg-transparent py-4 px-3 outline-none text-white text-sm"
                />
              </div>
            </div>

            {/* Empty view */}
            {filteredCollection.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-white/30 border border-dashed border-white/5 rounded-3xl">
                <ShoppingBag className="w-12 h-12 mb-3 text-white/10" />
                <span className="text-sm">No items found matching filter criteria.</span>
              </div>
            )}

            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCollection.map((item) => {
                const isPurchased = purchasedIds.includes(item.id);
                const isInstalled = installedIds.includes(item.id);
                const isDownloading = !!downloading[item.id];
                const percentage = downloading[item.id] || 0;

                return (
                  <motion.div
                    key={item.id}
                    layoutId={`store-card-${item.id}`}
                    className="relative rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300"
                  >
                    {/* Visual Card Banner background */}
                    <div 
                      className="h-32 relative flex items-end p-5"
                      style={{ background: item.wallpaper?.startsWith('http') ? `url('${item.wallpaper}') center/cover no-repeat` : item.wallpaper }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="relative z-10 flex gap-3 items-center">
                        <span className="text-xs bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full uppercase tracking-wider font-mono font-semibold">
                          {item.core?.toUpperCase() || 'NES'}
                        </span>
                        {item.isCustom && (
                          <span className="text-[10px] bg-sky-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wider font-mono font-semibold">
                            Admin Upload
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Description */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-lg font-medium text-white mb-1 leading-none">{item.title}</h3>
                      <p className="text-white/50 text-xs line-clamp-1 mb-6">{item.subtitle}</p>

                      <div className="mt-auto flex items-center justify-between">
                        {/* Cost/Price badge */}
                        <div>
                          <span className="text-[9px] text-white/40 block tracking-widest font-mono">VALUATION</span>
                          <span className="text-xl font-bold font-mono">
                            {item.price === 0 ? (
                              <span className="text-emerald-400">FREE</span>
                            ) : (
                              `$${item.price.toFixed(2)}`
                            )}
                          </span>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex gap-2">
                          {!isPurchased && !isDownloading ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleBuy(item)}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-full font-medium text-sm transition-all shadow-md shadow-blue-500/10 flex items-center gap-2"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              {item.price === 0 ? "Get" : "Purchase"}
                            </motion.button>
                          ) : (!isInstalled || isDownloading) ? (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleInstall(item, item.price === 0)}
                              className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${
                                isDownloading 
                                  ? "bg-slate-800 text-white cursor-not-allowed border border-white/10" 
                                  : "bg-white text-black hover:bg-neutral-200"
                              }`}
                              disabled={isDownloading}
                            >
                              {isDownloading ? (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                  <span>{percentage}%</span>
                                </div>
                              ) : (
                                <>
                                  <Download className="w-4 h-4" />
                                  Install
                                </>
                              )}
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                playSelectSound();
                                setStoreOpen(false);
                                //@ts-ignore
                                useUIStore.getState().playGame(item.core, item.romUrl);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-full font-medium text-sm transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              Play
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </AnimatePresence>
  );
}
