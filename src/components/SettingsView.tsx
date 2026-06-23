import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, X, Wifi, User, Shield, HardDrive, Volume2, Monitor, Gamepad, 
  Database, Bell, Video, Book, Cpu, Info, CheckCircle2, ChevronRight, 
  Check, Trash2, Plus, Sparkles, RefreshCw, VolumeX, Eye, ArrowLeft
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";
import { auth, rtdb } from "../lib/firebase";
import { ref, onValue, set as dbSet, push as dbPush, remove as dbRemove, update } from "firebase/database";

const CATEGORIES = [
  { id: 'guide', label: "User's Guide, Health & Safety", icon: Book },
  { id: 'accessibility', label: 'Accessibility', icon: User },
  { id: 'network', label: 'Network', icon: Wifi },
  { id: 'users', label: 'Users and Accounts', icon: User },
  { id: 'family', label: 'Family and Parental Controls', icon: Shield },
  { id: 'system', label: 'System', icon: Cpu },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'sound', label: 'Sound', icon: Volume2 },
  { id: 'screen', label: 'Screen and Video', icon: Monitor },
  { id: 'accessories', label: 'Accessories', icon: Gamepad },
  { id: 'saved_data', label: 'Saved Data and Game/App Settings', icon: Database },
];

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface SysInfo {
  ip: string;
  storageUsed: number;
  storageTotal: number;
  cores: number;
  memory: number;
  connectionType: string;
  platform: string;
  online: boolean;
  resolution: string;
}

// Subcomponents for deep settings integration
function CategoryContent({ categoryId, sysInfo }: { categoryId: string, sysInfo: SysInfo }) {
  const store = useUIStore();
  const { playNavigationSound, playSelectSound } = useAudio();

  // 1. Guide Tab State
  const [activeNotice, setActiveNotice] = useState<string | null>(null);

  // 2. Network Tab State
  const [wifiListOpen, setWifiListOpen] = useState(false);
  const [isConnectingWifi, setIsConnectingWifi] = useState(false);
  const [speedTestStep, setSpeedTestStep] = useState<'idle' | 'linking' | 'wan' | 'latency' | 'complete'>('idle');
  const [testResults, setTestResults] = useState({ download: 0, upload: 0, ping: 0 });

  // 3. Friends State (Synced dynamically with registered database users)
  const [friends, setFriends] = useState<{ id: string; name: string; status: string; online: boolean }[]>([]);
  const [friendNameInput, setFriendNameInput] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);

  // 4. Update Check State
  const [updateCheckState, setUpdateCheckState] = useState<'idle' | 'checking' | 'latest'>('idle');

  // 5. Game Saves and Quota override State
  const [customQuotaFree, setCustomQuotaFree] = useState<number | null>(null);
  const [savesList, setSavesList] = useState([
    { id: 's1', gameName: 'PSX - Castlevania Symphony', size: 12582912, date: '2026-06-21' },
    { id: 's2', gameName: 'GBA - Pokemon Emerald Hack', size: 1048576, date: '2026-06-22' },
    { id: 's3', gameName: 'SNES - Super Mario World Redux', size: 524288, date: '2026-06-20' }
  ]);

  // 7. Family Parental Protection & PIN states
  const [selectedAgeLevel, setSelectedAgeLevel] = useState('No Restrictions');
  const [parentralPin, setParentralPin] = useState("0000");
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // 8. Saved Data states
  const [cloudBackupActive, setCloudBackupActive] = useState(true);
  const [dbSyncStep, setDbSyncStep] = useState<'idle' | 'syncing' | 'synced'>('idle');
  
  // 9. Controller Auto Shutoff state
  const [autoShutoffOn, setAutoShutoffOn] = useState(true);

  // 6. Connected Gamepads feedback Loop
  const [detectedGamepads, setDetectedGamepads] = useState<any[]>([]);
  useEffect(() => {
    const fetchGamepads = () => {
      if (typeof navigator.getGamepads !== 'function') return;
      const list = navigator.getGamepads();
      const loaded: any[] = [];
      for (const gp of list) {
        if (!gp) continue;
        loaded.push({
          index: gp.index,
          id: gp.id,
          buttons: gp.buttons.map(b => b.pressed),
          axes: gp.axes
        });
      }
      setDetectedGamepads(loaded);
    };

    fetchGamepads();
    const interval = setInterval(fetchGamepads, 100);
    return () => clearInterval(interval);
  }, []);

  // Real-time Database user synchronizer for Game Base / Friends list
  useEffect(() => {
    const usersRef = ref(rtdb, "users");
    const unsubscribe = onValue(usersRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(uid => {
          const email = val[uid].email || "anonymous@sr5.com";
          const emailPrefix = email.split("@")[0];
          // Capitalize beautifully
          const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
          
          const games = ["PlayStation 1", "Metal Slug Retro", "Tetris Arcade Classic", "Sonic the Hedgehog", "Pokémon Emerald"];
          // Stable index based on uid sum
          const charSum = uid.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
          const activeGame = games[charSum % games.length];
          const isUserOnline = (charSum % 2 === 0);
          
          return {
            id: uid,
            name: displayName,
            status: isUserOnline ? `Playing ${activeGame}` : "Away",
            online: isUserOnline
          };
        });
        setFriends(list);
      } else {
        setFriends([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const OptionRow = ({ title, description, value, onClick, hasArrow = true }: { title: string, description?: string, value?: string, onClick?: () => void, hasArrow?: boolean }) => (
    <div 
      onClick={() => {
        if (onClick) {
          playSelectSound();
          onClick();
        }
      }} 
      className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex justify-between items-center group active:scale-[0.99]"
    >
      <div className="pr-4">
        <div className="text-xl font-medium mb-1">{title}</div>
        {description && <div className="text-white/50 text-sm leading-relaxed">{description}</div>}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {value && <span className="text-white/70 font-medium">{value}</span>}
        {hasArrow && <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white transition-colors" />}
      </div>
    </div>
  );

  const ToggleRow = ({ title, description, isOn, onToggle }: { title: string, description?: string, isOn: boolean, onToggle: (val: boolean) => void }) => (
    <div 
      onClick={() => {
        playSelectSound();
        onToggle(!isOn);
      }}
      className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer flex justify-between items-center group active:scale-[0.99]"
    >
      <div className="pr-4">
        <div className="text-xl font-medium mb-1">{title}</div>
        {description && <div className="text-white/50 text-sm leading-relaxed">{description}</div>}
      </div>
      <div className={`w-14 h-7 rounded-full relative shrink-0 transition-colors duration-300 shadow-inner ${isOn ? 'bg-white' : 'bg-white/20'}`}>
        <div className={`absolute top-1 w-5 h-5 rounded-full transition-transform duration-300 ${isOn ? 'right-1 bg-black' : 'left-1 bg-white'}`}></div>
      </div>
    </div>
  );

  // Connection Test simulation
  const runSpeedTest = () => {
    setSpeedTestStep('linking');
    setTimeout(() => {
      setSpeedTestStep('wan');
      setTimeout(() => {
        setSpeedTestStep('latency');
        setTimeout(() => {
          setTestResults({
            ping: Math.floor(Math.random() * 8) + 8,
            download: parseFloat((280 + Math.random() * 120).toFixed(1)),
            upload: parseFloat((40 + Math.random() * 30).toFixed(1))
          });
          setSpeedTestStep('complete');
        }, 1200);
      }, 1000);
    }, 800);
  };

  // Connect to Wi-Fi simulated delay
  const handleSelectSSID = (ssid: string) => {
    setIsConnectingWifi(true);
    setTimeout(() => {
      store.setWifiSSID(ssid);
      store.setIsOnline(true);
      setIsConnectingWifi(false);
      setWifiListOpen(false);
    }, 1500);
  };

  switch (categoryId) {
    case 'guide':
      if (activeNotice) {
        const titleMap: any = {
          safety: "Health and Safety Information",
          howtoplay: "Interactive Console Setup Guide",
          license: "Software Licenses & Credits"
        };
        const contentMap: any = {
          safety: `• EPILEPTIC FIT WARNING: A small percentage of individuals may experience epileptic seizures when exposed to certain light patterns or structures. Please place the console in a spacious room, play under ample room light, keep a comfortable viewing distance, and always consult a doctor if you feel dizzy or visually fatigued.\n• PERFECT POSTURE: Do not play for more than 1 Hour without taking a healthy 15-minute relaxation break. Sit straight and keep hand joints loose.\n• SYSTEM INTEGRITY: Secure console cables carefully. Keep away from extreme temperatures or moisture to protect internal hardware conduction.`,
          howtoplay: `Welcome to the ultimate System Emulator Interface!\n• PLAYING EMULATION CORES: Tap any core on the home scroll (like SR5 Core 1, Game Boy Advance, Sega Genesis) and click "Play Core" to boot EmulatorJS.\n• LOADING PHYSICAL ROMS: Click "Load ROM" and upload any standard ROM file (like .zip, .rom, .gba, .snes). The system loader is secure and runs purely server-sandbox local.\n• MENU SYSTEM: Trigger 'P' on keyboard, or click the bottom-right helpers to pop open quick settings. Escape key acts as standard exit.`,
          license: `• CORE ARCHITECTURE: Embedded EmulatorJS (RetroArch Libretro WASM compilation).\n• GRAPHICS ENGINE: Designed using high-performance Three.js WebGL particle frames and @react-three/fiber.\n• FRAMEWORKS: Powered by React 19, Vite, Tailwind CSS Utility, Lucide Icons, and dynamic Zustand stores.`
        };
        return (
          <div className="space-y-6">
            <button 
              onClick={() => { playSelectSound(); setActiveNotice(null); }}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Guides
            </button>
            <div className="p-8 bg-white/5 rounded-2xl border border-white/5 leading-relaxed">
              <h4 className="text-2xl font-light mb-6 text-white border-b border-white/10 pb-4">{titleMap[activeNotice]}</h4>
              <div className="text-white/80 whitespace-pre-wrap space-y-4 font-light text-base leading-loose">
                {contentMap[activeNotice]}
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <OptionRow title="Health and Safety Information" description="Read important health and safety information before using this product." onClick={() => setActiveNotice('safety')} />
          <OptionRow title="User's Guide" description="View details on running emulator cores, keybinds, and ROMs." onClick={() => setActiveNotice('howtoplay')} />
          <OptionRow title="Intellectual Property Notices" description="View software certifications, copyright, and library credits." onClick={() => setActiveNotice('license')} />
        </div>
      );

    case 'accessibility':
      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Vision Controls</div>
          <ToggleRow 
            title="Invert Colors" 
            description="Toggle full color inversion of the browser viewport in real time." 
            isOn={store.invertColors} 
            onToggle={(val) => store.setInvertColors(val)} 
          />
          <ToggleRow 
            title="High Contrast" 
            description="Aggressively boost foreground contrast for superior readability." 
            isOn={store.highContrast} 
            onToggle={(val) => store.setHighContrast(val)} 
          />
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <label className="text-sm text-white/50 block font-medium">Text Size Scale</label>
            <div className="flex gap-4">
              {(['Small', 'Normal', 'Large'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => { playSelectSound(); store.setTextSize(sz); }}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${store.textSize === sz ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  {sz} Scale
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'network':
      return (
        <div className="space-y-4">
          <ToggleRow 
            title="Connect to the Internet" 
            description="Toggle current sandbox internet connection state." 
            isOn={store.isOnline} 
            onToggle={(val) => store.setIsOnline(val)} 
          />
          
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
            <div className="text-xl font-medium mb-4 flex items-center justify-between">
              <span>Wireless and Router Status</span>
              {isConnectingWifi && <RefreshCw className="w-5 h-5 text-white/50 animate-spin" />}
            </div>
            <div className="grid grid-cols-2 gap-y-4 text-sm font-light">
              <div className="text-white/50">Active SSID</div>
              <div className="text-white font-medium">{store.isOnline ? store.wifiSSID : 'Not Connected'}</div>
              <div className="text-white/50">Local Web IP</div>
              <div className="text-white font-mono font-medium">{store.isOnline ? sysInfo.ip : 'Disconnected'}</div>
              <div className="text-white/50">Connection Medium</div>
              <div className="text-white font-medium">{sysInfo.connectionType}</div>
            </div>
          </div>

          {/* Wi-Fi SSID selector */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <button 
              onClick={() => { playSelectSound(); setWifiListOpen(!wifiListOpen); }}
              className="w-full flex justify-between items-center text-left py-2"
            >
              <div>
                <div className="text-xl font-medium">Manage Wi-Fi Networks</div>
                <div className="text-white/50 text-sm">Scan and hop onto available secure bands.</div>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${wifiListOpen ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {wifiListOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden pt-4"
                >
                  {['StarlinkRouter_5G', 'GigaFiber_Home', 'MD_Sarkar_Private', 'CafeWiFi_Free'].map((ssid) => (
                    <button
                      key={ssid}
                      onClick={() => handleSelectSSID(ssid)}
                      className={`w-full p-4 rounded-xl text-left border hover:bg-white/10 transition-all flex items-center justify-between ${store.wifiSSID === ssid && store.isOnline ? 'border-white bg-white/5' : 'border-white/5 bg-black/20'}`}
                      disabled={isConnectingWifi}
                    >
                      <div className="flex items-center gap-3">
                        <Wifi className="w-5 h-5 text-white/70" />
                        <span className="font-medium">{ssid}</span>
                      </div>
                      {store.wifiSSID === ssid && store.isOnline ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <span className="text-xs text-white/40">Secure (WPA2)</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interactive Network Diagnostic Test */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xl font-medium">Speed and Latency Benchmark</div>
                <div className="text-white/50 text-sm">Measure actual network metrics safely.</div>
              </div>
              {speedTestStep === 'idle' || speedTestStep === 'complete' ? (
                <button 
                  onClick={runSpeedTest} 
                  className="bg-white text-black px-5 py-2 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform"
                >
                  Run test
                </button>
              ) : (
                <RefreshCw className="w-6 h-6 text-white/50 animate-spin" />
              )}
            </div>

            {speedTestStep !== 'idle' && (
              <div className="space-y-3 pt-2">
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: speedTestStep === 'linking' ? '25%' : 
                             speedTestStep === 'wan' ? '50%' : 
                             speedTestStep === 'latency' ? '75%' : '100%' 
                    }}
                    className="h-full bg-white"
                  />
                </div>
                <p className="text-white/60 text-xs tracking-wider uppercase font-mono">
                  {speedTestStep === 'linking' && "Establishing secure handshake..."}
                  {speedTestStep === 'wan' && "Verifying ISP dynamic gateway connection..."}
                  {speedTestStep === 'latency' && "Measuring server latency ping times..."}
                  {speedTestStep === 'complete' && "All tests passed successfully!"}
                </p>

                {speedTestStep === 'complete' && (
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-white/40 uppercase tracking-widest">Ping Latency</div>
                      <div className="text-xl font-bold font-mono text-white pt-1">{testResults.ping} <span className="text-xs font-light">ms</span></div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-white/40 uppercase tracking-widest">Download</div>
                      <div className="text-xl font-bold font-mono text-green-400 pt-1">{testResults.download} <span className="text-xs font-light">Mbps</span></div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-white/40 uppercase tracking-widest">Upload</div>
                      <div className="text-xl font-bold font-mono text-blue-400 pt-1">{testResults.upload} <span className="text-xs font-light font-sans">Mbps</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );

    case 'users':
      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Personal Profile Settings</div>
          
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h5 className="text-lg font-medium">User Credentials</h5>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">Display Alias</label>
                <input
                  type="text"
                  value={store.userName}
                  onChange={(e) => store.setUserName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Secure Contact Email</label>
                <input
                  type="text"
                  value={store.userEmail}
                  onChange={(e) => store.setUserEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h5 className="text-lg font-medium">Active Game Base (Friends)</h5>
                <p className="text-white/50 text-xs">Manage your interactive buddy invite lists.</p>
              </div>
              <button 
                onClick={() => { playSelectSound(); setShowAddFriend(!showAddFriend); }} 
                className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <AnimatePresence>
              {showAddFriend && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex gap-2 bg-black/30 p-3 rounded-xl border border-white/10"
                >
                  <input
                    type="text"
                    placeholder="Enter friend name..."
                    value={friendNameInput}
                    onChange={(e) => setFriendNameInput(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-white/40"
                  />
                  <button
                    onClick={() => {
                      if (!friendNameInput) return;
                      playSelectSound();
                      const cleanEmail = friendNameInput.toLowerCase().includes("@")
                        ? friendNameInput.toLowerCase()
                        : `${friendNameInput.toLowerCase()}@sr5-console.com`;
                      const newUserRef = dbPush(ref(rtdb, "users"));
                      dbSet(newUserRef, {
                        email: cleanEmail,
                        lastLogin: new Date().toISOString()
                      });
                      setFriendNameInput('');
                      setShowAddFriend(false);
                    }}
                    className="bg-white text-black px-4 py-1 text-sm rounded-lg font-medium"
                  >
                    Add
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              {friends.map((friend) => (
                <div key={friend.id} className="p-4 bg-black/20 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${friend.online ? 'bg-green-400' : 'bg-white/20'}`} />
                    <div>
                      <div className="font-medium text-sm">{friend.name}</div>
                      <div className="text-xs text-white/50">{friend.status}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      playSelectSound();
                      dbRemove(ref(rtdb, `users/${friend.id}`));
                    }}
                    className="text-white/30 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'family':
      const [parentalEnabled, setParentalEnabled] = useState(false);
      const [maxDailyMinutes, setMaxDailyMinutes] = useState(120);
      const [parentalPinFirebase, setParentalPinFirebase] = useState("0000");
      const [pinSaveSuccess, setPinSaveSuccess] = useState(false);

      useEffect(() => {
        if (!auth.currentUser) return;
        const unsub = onValue(ref(rtdb, `users/${auth.currentUser.uid}/parentalControls`), (snap) => {
          if (snap.exists()) {
            const d = snap.val();
            setParentalEnabled(d.enabled || false);
            setMaxDailyMinutes(d.maxDailyMinutes || 120);
            setParentalPinFirebase(d.pin || "0000");
          }
        });
        return () => unsub();
      }, []);

      const saveParental = async (updates: Record<string, any>) => {
        if (!auth.currentUser) return;
        try {
          await update(ref(rtdb, `users/${auth.currentUser.uid}/parentalControls`), updates);
        } catch (e) { console.error('Parental save error', e); }
      };

      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Parental Protection</div>

          <ToggleRow
            title="Parental Controls"
            description="Restrict play time and require PIN for settings changes"
            isOn={parentalEnabled}
            onToggle={(v) => {
              setParentalEnabled(v);
              saveParental({ enabled: v });
            }}
          />

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h5 className="text-lg font-medium">Play Time Limit (per day)</h5>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={30}
                max={480}
                step={15}
                value={maxDailyMinutes}
                onChange={(e) => setMaxDailyMinutes(Number(e.target.value))}
                onMouseUp={() => saveParental({ maxDailyMinutes })}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-xl font-bold font-mono text-indigo-300 w-16 text-right">{maxDailyMinutes}m</span>
            </div>
            <p className="text-white/40 text-xs">Set between 30 min and 8 hours per day.</p>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h5 className="text-lg font-medium">Console PIN Management</h5>
            <div className="flex gap-3 items-center">
              <input
                type="password"
                maxLength={4}
                value={parentalPinFirebase}
                onChange={(e) => {
                  setParentalPinFirebase(e.target.value);
                  setPinSaveSuccess(false);
                }}
                className="bg-black/40 border border-white/10 px-4 py-3 rounded-xl text-center text-xl font-bold font-mono tracking-widest text-white w-28 focus:outline-none focus:border-white"
              />
              <button
                onClick={() => {
                  playSelectSound();
                  saveParental({ pin: parentalPinFirebase });
                  setPinSaveSuccess(true);
                  setTimeout(() => setPinSaveSuccess(false), 2000);
                }}
                className="bg-white/10 hover:bg-white hover:text-black border border-white/15 px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              >
                Change PIN
              </button>
              {pinSaveSuccess && (
                <motion.span
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-green-400 text-sm font-medium flex items-center gap-1 ml-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> PIN saved
                </motion.span>
              )}
            </div>
            <p className="text-white/40 text-xs leading-relaxed">Default protection passcode is 0000. Used to override daily limits.</p>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h5 className="text-lg font-medium">Age Restriction Profile</h5>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Level 1: Child', desc: 'Under 12 years' },
                { label: 'Level 2: Teen', desc: 'Under 16 years' },
                { label: 'No Restrictions', desc: 'Unrestricted access' }
              ].map((lvl) => {
                const isActive = selectedAgeLevel === lvl.label;
                return (
                  <button
                    key={lvl.label}
                    onClick={() => {
                      playSelectSound();
                      setSelectedAgeLevel(lvl.label);
                    }}
                    className={`p-4 rounded-xl text-left transition-all border flex flex-col justify-between h-28 relative ${isActive ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-[1.02]' : 'bg-black/20 text-white border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                  >
                    <div className="font-semibold text-sm">{lvl.label}</div>
                    <div className={`text-xs ${isActive ? 'text-black/60' : 'text-white/50'}`}>{lvl.desc}</div>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-black absolute top-3 right-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );

    case 'system':
      const triggerCheckUpdate = () => {
        setUpdateCheckState('checking');
        setTimeout(() => {
          setUpdateCheckState('latest');
        }, 1800);
      };

      return (
        <div className="space-y-6">
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
            <h4 className="text-xl font-medium mb-5 flex items-center gap-3"><Info className="w-6 h-6 text-white/70"/> Console Hardware Matrix</h4>
            <div className="grid grid-cols-2 gap-y-4 text-sm font-light">
              <div className="text-white/50">Core Console Name</div>
              <div className="font-medium">
                <input
                  type="text"
                  value={store.consoleName}
                  onChange={(e) => store.setConsoleName(e.target.value)}
                  className="bg-transparent border-b border-transparent focus:border-white hover:border-white/30 px-1 py-0.5 text-white focus:outline-none max-w-[180px] font-medium"
                />
              </div>
              <div className="text-white/50">OS Type / Environment</div>
              <div className="text-white font-medium">{sysInfo.platform}</div>
              <div className="text-white/50">Processor Cores</div>
              <div className="text-white font-mono font-medium">{sysInfo.cores} Hardware Threads</div>
              <div className="text-white/50">Host Platform memory</div>
              <div className="text-white font-mono font-medium">~{sysInfo.memory} GB Allocated</div>
            </div>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xl font-medium">System Software Update</div>
                <div className="text-white/50 text-sm">Check, compile, or install the latest retro system features.</div>
              </div>
              {updateCheckState === 'idle' ? (
                <button 
                  onClick={triggerCheckUpdate} 
                  className="bg-white text-black px-5 py-2.5 rounded-full font-semibold text-sm hover:scale-105 active:scale-95 transition-transform"
                >
                  Check Update
                </button>
              ) : updateCheckState === 'checking' ? (
                <div className="flex items-center gap-2 text-white/50">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Scanning...
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 font-semibold">
                  <Check className="w-5 h-5" /> running current (v26.06.22)
                </div>
              )}
            </div>
          </div>

          <ToggleRow 
            title="Maintain Controller Auto Shutoff" 
            description="Power down virtual connection arrays if inactive for 10 minutes." 
            isOn={autoShutoffOn} 
            onToggle={(val) => setAutoShutoffOn(val)} 
          />
        </div>
      );

    case 'storage':
      const totalSavesSize = savesList.reduce((acc, curr) => acc + curr.size, 0);
      const usedFormatted = formatBytes((customQuotaFree !== null ? customQuotaFree : sysInfo.storageUsed) + totalSavesSize);
      const freeBytes = Math.max(0, sysInfo.storageTotal - ((customQuotaFree !== null ? customQuotaFree : sysInfo.storageUsed) + totalSavesSize));
      const freeFormatted = formatBytes(freeBytes);
      const usedPercent = sysInfo.storageTotal > 0 ? (((customQuotaFree !== null ? customQuotaFree : sysInfo.storageUsed) + totalSavesSize) / sysInfo.storageTotal) * 100 : 0;

      const deleteSave = (id: string, size: number) => {
        playSelectSound();
        setSavesList(prev => prev.filter(item => item.id !== id));
      };

      const formatSizeToMB = (bytes: number) => {
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
      };

      const wipeDataConfig = () => {
        const conf = confirm("WARNING: Are you absolutely sure you want to initialize the SR5 Console? This will factory-reset all names, theme colours, and browser game stores completely.");
        if (conf) {
          localStorage.clear();
          window.location.reload();
        }
      };

      return (
        <div className="space-y-6">
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 shadow-lg">
            <div className="text-xl font-medium mb-6">Console Partition Allocation</div>
            <div className="flex justify-between text-sm text-white/80 mb-3 font-medium">
              <span>{usedFormatted} Active</span>
              <span>{freeFormatted} Free</span>
            </div>
            <div className="w-full h-5 bg-black/50 rounded-full overflow-hidden flex shadow-inner border border-white/10">
              <motion.div initial={{ width: 0 }} animate={{ width: `${usedPercent}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></motion.div>
            </div>
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-4 text-sm font-medium"><div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div> <span className="text-white/80 w-40">System Core & Extracted Saves</span> <span className="text-white">{usedFormatted}</span></div>
              <div className="flex items-center gap-4 text-sm font-medium"><div className="w-4 h-4 rounded-full bg-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div> <span className="text-white/80 w-40">Remaining Quota</span> <span className="text-white">{freeFormatted}</span></div>
            </div>
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h5 className="text-lg font-medium">Memory Cache (Individual Save States)</h5>
            {savesList.length === 0 ? (
              <p className="text-white/40 text-sm">All cache slots are empty. Storage quota is beautifully clean.</p>
            ) : (
              <div className="space-y-3">
                {savesList.map((save) => (
                  <div key={save.id} className="p-4 bg-black/20 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm text-white/90">{save.gameName}</div>
                      <div className="text-xs text-white/40">Timestamped save • {save.date}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/60 font-mono">{formatSizeToMB(save.size)}</span>
                      <button 
                        onClick={() => deleteSave(save.id, save.size)}
                        className="text-white/35 hover:text-red-400 p-2 rounded-xl transition-all hover:bg-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
            <div>
              <div className="text-xl font-medium text-red-400">Master Initialize System</div>
              <p className="text-white/50 text-sm">Restore factory defaults and wipe browser local cache.</p>
            </div>
            <button 
              onClick={wipeDataConfig}
              className="bg-red-500/15 hover:bg-red-500 text-red-100 border border-red-500/20 px-6 py-2.5 rounded-full font-semibold transition-all text-sm active:scale-95"
            >
              Reset SR5 Catalog
            </button>
          </div>
        </div>
      );

    case 'sound':
      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Master Volume Out</div>
          
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between font-medium">
              <span>Main Output Gain</span>
              <span>{store.systemVolume}%</span>
            </div>
            <div className="flex items-center gap-4">
              <VolumeX className="w-5 h-5 text-white/40" />
              <input
                type="range"
                min={0}
                max={100}
                value={store.systemVolume}
                onChange={(e) => store.setSystemVolume(Number(e.target.value))}
                className="flex-1 accent-white bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
              />
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs text-white/40">Adjust gain parameters of built-in synthesized oscillators dynamically.</p>
          </div>

          <ToggleRow 
            title="Interactive Beeps & Swipes" 
            description="Toggle navigation audio sound triggers when navigating headers." 
            isOn={store.soundOn} 
            onToggle={(val) => store.setSoundOn(val)} 
          />
        </div>
      );

    case 'screen':
      return (
        <div className="space-y-4">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Target Resolutions</div>
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <label className="text-sm text-white/50 block font-medium">Active Screen Output</label>
            <div className="grid grid-cols-2 gap-3">
              {['Automatic (4K)', '1440p QuadHD', '1080p FullHD', '720p HD Ready'].map((res) => (
                <button
                  key={res}
                  onClick={() => { playSelectSound(); store.setResolutionSetting(res); }}
                  className={`p-4 rounded-xl text-left font-medium transition-all ${store.resolutionSetting === res ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow 
            title="Auto HDR Profile" 
            description="Inject high-dynamic contrast styles if compatible with display panel." 
            isOn={store.hdrEnabled} 
            onToggle={(val) => store.setHdrEnabled(val)} 
          />
        </div>
      );

    case 'accessories':
      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">Controller Interface</div>

          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="text-lg font-medium">DualSense / USB Gamepad Status</h5>
              <div className={`px-3 py-1 text-xs rounded-full font-bold uppercase ${detectedGamepads.length > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-white/40'}`}>
                {detectedGamepads.length > 0 ? 'Connected' : 'Looking for input'}
              </div>
            </div>

            {detectedGamepads.length === 0 ? (
              <div className="text-sm text-white/50 leading-relaxed space-y-2">
                <p>No external joystick/gamepad detected via the standard Gamepad API. Connect any Xbox, Sony DualSense, or generic controller and tap any button to establish connection.</p>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5 font-mono text-[11px] leading-normal text-white/60">
                  Fallback keyboard mapper active: {"\n"}
                  • D-pad Movement: Keyboard Arrow Keys {"\n"}
                  • Emulated "SELECT/START": Enter Key {"\n"}
                  • SR5 System Menu Overlay: 'P' Button
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {detectedGamepads.map((gp, i) => (
                  <div key={i} className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
                    <div className="text-sm font-semibold">{gp.id}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-white/50">Axes inputs (D-Pad):</div>
                      <div className="font-mono text-white">{gp.axes.map((a: number) => a.toFixed(1)).join(', ')}</div>
                      <div className="text-white/50">Pressed Buttons Matrix:</div>
                      <div className="font-mono text-white">{gp.buttons.map((p: boolean, idx: number) => p ? `[B${idx}]` : '').filter(Boolean).join(' ') || 'None'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case 'saved_data':
      return (
        <div className="space-y-6">
          <div className="mb-4 border-b border-white/10 pb-4 text-white/50 font-medium tracking-wide uppercase text-sm">State Files</div>
          
          <ToggleRow 
            title="Auto Cloud Backup Settings" 
            description="Automatically sync saved emulator blocks and game save states to cloud catalog storage." 
            isOn={cloudBackupActive}
            onToggle={(val) => {
              setCloudBackupActive(val);
            }} 
          />

          <div 
            onClick={() => {
              if (dbSyncStep !== 'idle') return;
              playSelectSound();
              setDbSyncStep('syncing');
              setTimeout(() => {
                setDbSyncStep('synced');
              }, 1600);
            }}
            className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 transition-all cursor-pointer flex justify-between items-center group active:scale-[0.99]"
          >
            <div className="pr-4">
              <div className="text-xl font-medium mb-1">Update Game Databases</div>
              <div className="text-white/50 text-sm leading-relaxed">Retrieve and compile latest metadata listings from secure server catalog.</div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {dbSyncStep === 'idle' && <span className="text-white/40 text-sm font-semibold uppercase tracking-wider bg-white/5 px-3 py-1.5 rounded-lg">Sync Now</span>}
              {dbSyncStep === 'syncing' && (
                <div className="flex items-center gap-2 text-white/60 text-sm font-medium bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  <RefreshCw className="w-4 h-4 animate-spin text-white/70" /> Compiling...
                </div>
              )}
              {dbSyncStep === 'synced' && (
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                  <Check className="w-4 h-4" /> Databases Updated
                </div>
              )}
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white transition-all" />
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <OptionRow key={item} title={`${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)} Setting ${item}`} description={`Configure parameters and preferences for ${categoryId}.`} />
          ))}
        </div>
      );
  }
}

export function SettingsView() {
  const store = useUIStore();
  const { isSettingsOpen, setSettingsOpen } = useUIStore();
  const [activeIndex, setActiveIndex] = useState(5);
  const { playNavigationSound, playSelectSound } = useAudio();

  const [sysInfo, setSysInfo] = useState<SysInfo>({
    ip: 'Detecting...',
    storageUsed: 0,
    storageTotal: 0,
    cores: window.navigator.hardwareConcurrency || 8,
    memory: (window.navigator as any).deviceMemory || 8,
    connectionType: (window.navigator as any).connection?.effectiveType || 'Wi-Fi',
    platform: window.navigator.platform || window.navigator.userAgent,
    online: window.navigator.onLine,
    resolution: `${window.screen.width}x${window.screen.height}`
  });

  // Watch Accessibility states to alter actual browser view aesthetics!
  useEffect(() => {
    // 1. Color Inversion
    if (store.invertColors) {
      document.documentElement.style.filter = "invert(1) hue-rotate(180deg)";
    } else {
      document.documentElement.style.filter = "none";
    }

    // 2. High Contrast
    if (store.highContrast) {
      document.documentElement.style.textShadow = "0 0 1px #fff";
      document.documentElement.classList.add("high-contrast-mode");
    } else {
      document.documentElement.style.textShadow = "none";
      document.documentElement.classList.remove("high-contrast-mode");
    }

    // 3. Text Size scale
    if (store.textSize === 'Large') {
      document.documentElement.style.fontSize = "18px";
    } else if (store.textSize === 'Small') {
      document.documentElement.style.fontSize = "14px";
    } else {
      document.documentElement.style.fontSize = "16px";
    }
  }, [store.invertColors, store.highContrast, store.textSize]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setSysInfo(prev => ({ ...prev, ip: data.ip })))
      .catch(() => setSysInfo(prev => ({ ...prev, ip: 'Unavailable' })));

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(est => {
        setSysInfo(prev => ({
          ...prev,
          storageUsed: est.usage || 4520194,
          storageTotal: est.quota || 536870912,
        }));
      });
    }

    const handleOnline = () => setSysInfo(prev => ({ ...prev, online: true }));
    const handleOffline = () => setSysInfo(prev => ({ ...prev, online: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSettingsOpen) return;
      if (e.key === 'Escape') {
        playSelectSound();
        setSettingsOpen(false);
      } else if (e.key === 'ArrowUp') {
        playNavigationSound();
        setActiveIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown') {
        playNavigationSound();
        setActiveIndex(prev => Math.min(CATEGORIES.length - 1, prev + 1));
      } else if (e.key === 'Enter') {
        playSelectSound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, playNavigationSound, playSelectSound, setSettingsOpen]);

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-[#121212]/95 backdrop-blur-3xl flex text-white pointer-events-auto select-none"
        >
          {/* Header */}
          <div className="absolute top-0 left-0 w-full p-8 flex items-center justify-between border-b border-white/10 bg-black/40 z-20">
            <div className="flex items-center gap-4">
              <Settings className="w-8 h-8" />
              <h2 className="text-2xl font-light tracking-wide">{store.consoleName} System Settings</h2>
            </div>
            <button 
              onClick={() => { playSelectSound(); setSettingsOpen(false); }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* Sidebar */}
          <div className="w-[35%] h-full pt-32 px-8 overflow-y-auto border-r border-white/10 scrollbar-hide z-10">
            <div className="space-y-2 pb-16">
              {CATEGORIES.map((cat, idx) => {
                const Icon = cat.icon;
                const isActive = activeIndex === idx;
                return (
                  <div 
                    key={cat.id}
                    onMouseEnter={() => {
                      if (activeIndex !== idx) {
                        playNavigationSound();
                        setActiveIndex(idx);
                      }
                    }}
                    onClick={() => {
                      if (activeIndex !== idx) {
                        playNavigationSound();
                        setActiveIndex(idx);
                      }
                      playSelectSound();
                    }}
                    className={`group cursor-pointer flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-300 ${isActive ? 'bg-white text-black bg-opacity-100 scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon className="w-6 h-6 shrink-0" />
                    <span className="font-medium text-lg tracking-wide">{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings Content Pane */}
          <div className="flex-1 h-full pt-32 px-16 overflow-y-auto scrollbar-hide pb-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-3xl font-light mb-10 border-b border-white/10 pb-6 flex items-center gap-4">
                  {(() => { const Icon = CATEGORIES[activeIndex].icon; return <Icon className="w-8 h-8 text-white/50" />; })()}
                  {CATEGORIES[activeIndex].label}
                </h3>
                
                <CategoryContent categoryId={CATEGORIES[activeIndex].id} sysInfo={sysInfo} />
              </motion.div>
            </AnimatePresence>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
