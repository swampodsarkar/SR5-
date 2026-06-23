import { create } from 'zustand';
import { Game, MOckGames } from '../data/games';

interface UIState {
  systemTime: string;
  activeCategory: string;
  activeGameId: string | null;
  activeWallpaper: string | null;
  activeThemeColor: string;
  isControlCenterOpen: boolean;
  isSettingsOpen: boolean;
  isPlaying: boolean;
  playingCore: string;
  gameUrl: string | null;
  isBooting: boolean;
  
  gamesList: Game[];
  setGamesList: (games: Game[]) => void;
  
  // Custom interactive console state
  consoleName: string;
  userName: string;
  userEmail: string;
  isOnline: boolean;
  wifiSSID: string;
  invertColors: boolean;
  highContrast: boolean;
  textSize: 'Small' | 'Normal' | 'Large';
  systemVolume: number;
  soundOn: boolean;
  resolutionSetting: string;
  hdrEnabled: boolean;
  
  // Custom Firebase interactive states
  isStoreOpen: boolean;
  isProfileOpen: boolean;
  isBanned: boolean;
  isPairingOpen: boolean;
  setPairingOpen: (isOpen: boolean) => void;
  activeRoomId: string | null;
  controllerCode: string;
  controllerCodeP2: string;
  controllerCodeP3: string;
  controllerCodeP4: string;
  isControllerConnected: boolean;
  isControllerConnectedP2: boolean;
  isControllerConnectedP3: boolean;
  isControllerConnectedP4: boolean;
  setControllerConnected: (connected: boolean) => void;
  setControllerConnectedP2: (connected: boolean) => void;
  setControllerConnectedP3: (connected: boolean) => void;
  setControllerConnectedP4: (connected: boolean) => void;
  
  // Actions
  finishBooting: () => void;
  setControlCenterOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setStoreOpen: (isOpen: boolean) => void;
  setProfileOpen: (isOpen: boolean) => void;
  setActiveRoomId: (id: string | null) => void;
  setBanned: (isBanned: boolean) => void;
  setActiveCategory: (cat: string) => void;
  setActiveGame: (id: string, wallpaper: string, color: string) => void;
  playGame: (core: string, gameUrl?: string) => void;
  stopPlaying: () => void;
  updateTime: () => void;
  
  // Custom interactive setters
  setConsoleName: (name: string) => void;
  setUserName: (name: string) => void;
  setUserEmail: (email: string) => void;
  setIsOnline: (online: boolean) => void;
  setWifiSSID: (ssid: string) => void;
  setInvertColors: (invert: boolean) => void;
  setHighContrast: (hc: boolean) => void;
  setTextSize: (s: 'Small' | 'Normal' | 'Large') => void;
  setSystemVolume: (v: number) => void;
  setSoundOn: (on: boolean) => void;
  setResolutionSetting: (r: string) => void;
  setHdrEnabled: (hdr: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  systemTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  activeCategory: 'Games',
  activeGameId: 'g1',
  activeWallpaper: 'linear-gradient(to right bottom, #111111, #434343)',
  activeThemeColor: '#ffffff',
  isControlCenterOpen: false,
  isSettingsOpen: false,
  isBooting: true,
  isPlaying: false,
  playingCore: 'psx',
  gameUrl: null,
  isStoreOpen: false,
  isProfileOpen: false,
  isBanned: false,
  isPairingOpen: false,
  activeRoomId: null,
  isControllerConnected: false,
  isControllerConnectedP2: false,
  isControllerConnectedP3: false,
  isControllerConnectedP4: false,
  controllerCode: localStorage.getItem("sys_controller_code") || (() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem("sys_controller_code", code);
    return code;
  })(),
  controllerCodeP2: localStorage.getItem("sys_controller_code_p2") || (() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem("sys_controller_code_p2", code);
    return code;
  })(),
  controllerCodeP3: localStorage.getItem("sys_controller_code_p3") || (() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem("sys_controller_code_p3", code);
    return code;
  })(),
  controllerCodeP4: localStorage.getItem("sys_controller_code_p4") || (() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem("sys_controller_code_p4", code);
    return code;
  })(),
  gamesList: MOckGames,
  
  // Initial values from localStorage or sensible defaults
  consoleName: localStorage.getItem('sys_console_name') || 'SR5 Console',
  userName: localStorage.getItem('sys_user_name') || 'MD Swampod Sarkar',
  userEmail: localStorage.getItem('sys_user_email') || 'mdswampodsarkar007@gmail.com',
  isOnline: localStorage.getItem('sys_is_online') !== 'false',
  wifiSSID: localStorage.getItem('sys_wifi_ssid') || 'StarlinkRouter_5G',
  invertColors: localStorage.getItem('sys_invert_colors') === 'true',
  highContrast: localStorage.getItem('sys_high_contrast') === 'true',
  textSize: (localStorage.getItem('sys_text_size') as 'Small' | 'Normal' | 'Large') || 'Normal',
  systemVolume: Number(localStorage.getItem('sys_system_volume')) || 80,
  soundOn: localStorage.getItem('sys_sound_on') !== 'false',
  resolutionSetting: localStorage.getItem('sys_resolution') || 'Automatic (4K)',
  hdrEnabled: localStorage.getItem('sys_hdr') !== 'false',

  finishBooting: () => set({ isBooting: false }),
  setControlCenterOpen: (isOpen) => set({ isControlCenterOpen: isOpen }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setStoreOpen: (isOpen) => set({ isStoreOpen: isOpen }),
  setProfileOpen: (isOpen) => set({ isProfileOpen: isOpen }),
  setPairingOpen: (isOpen) => set({ isPairingOpen: isOpen }),
  setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
  setBanned: (isBanned) => set({ isBanned }),
  setControllerConnected: (connected) => set({ isControllerConnected: connected }),
  setControllerConnectedP2: (connected) => set({ isControllerConnectedP2: connected }),
  setControllerConnectedP3: (connected) => set({ isControllerConnectedP3: connected }),
  setControllerConnectedP4: (connected) => set({ isControllerConnectedP4: connected }),
  setGamesList: (gamesList) => set({ gamesList }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  setActiveGame: (id, wallpaper, color) => set({ activeGameId: id, activeWallpaper: wallpaper, activeThemeColor: color }),
  playGame: (core, url) => set({ isPlaying: true, playingCore: core, gameUrl: url || null }),
  stopPlaying: () => set((state) => {
    if (state.gameUrl && state.gameUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.gameUrl);
    }
    return { isPlaying: false, gameUrl: null };
  }),
  updateTime: () => set({ systemTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),

  setConsoleName: (name) => {
    localStorage.setItem('sys_console_name', name);
    set({ consoleName: name });
  },
  setUserName: (name) => {
    localStorage.setItem('sys_user_name', name);
    set({ userName: name });
  },
  setUserEmail: (email) => {
    localStorage.setItem('sys_user_email', email);
    set({ userEmail: email });
  },
  setIsOnline: (online) => {
    localStorage.setItem('sys_is_online', String(online));
    set({ isOnline: online });
  },
  setWifiSSID: (ssid) => {
    localStorage.setItem('sys_wifi_ssid', ssid);
    set({ wifiSSID: ssid });
  },
  setInvertColors: (invert) => {
    localStorage.setItem('sys_invert_colors', String(invert));
    set({ invertColors: invert });
  },
  setHighContrast: (hc) => {
    localStorage.setItem('sys_high_contrast', String(hc));
    set({ highContrast: hc });
  },
  setTextSize: (s) => {
    localStorage.setItem('sys_text_size', s);
    set({ textSize: s });
  },
  setSystemVolume: (v) => {
    localStorage.setItem('sys_system_volume', String(v));
    set({ systemVolume: v });
  },
  setSoundOn: (on) => {
    localStorage.setItem('sys_sound_on', String(on));
    set({ soundOn: on });
  },
  setResolutionSetting: (r) => {
    localStorage.setItem('sys_resolution', r);
    set({ resolutionSetting: r });
  },
  setHdrEnabled: (hdr) => {
    localStorage.setItem('sys_hdr', String(hdr));
    set({ hdrEnabled: hdr });
  }
}));
