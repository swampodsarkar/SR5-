export interface Game {
  id: string;
  title: string;
  subtitle: string;
  image: string; 
  wallpaper: string;
  themeColor: string;
  progress: number;
  core?: string;
  isSystem?: boolean;
  icon?: string;
  romUrl?: string;
}

export const MOckGames: Game[] = [];

export const SystemApps = [
  { id: "store", title: "SR5 Store", icon: "Store" },
  { id: "explore", title: "Explore", icon: "Compass" },
];
