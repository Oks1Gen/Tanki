export type TankModel = "e100" | "t34" | "t100lt";

export type AmmoType = "ap" | "heat" | "he";

export type CamoType = "" | "forest" | "desert" | "winter";

export interface GameSettings {
  tankModel: TankModel;
  botCount: number;
  upgrades: Record<string, number>;
  goldUpgrades?: Record<string, boolean>;
  camo?: CamoType;
}

export interface UpgradeLevelDef {
  xpCost: number;
  label: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxLevel: number;
  levels: UpgradeLevelDef[];
}

export interface PlayerStats {
  totalKills: number;
  totalDamage: number;
  totalWins: number;
  totalLosses: number;
  totalGames: number;
  totalShotsFired: number;
  totalShotsHit: number;
}

export interface PlayerProgress {
  xp: number;
  gold: number;
  upgrades: Record<string, number>;
  goldUpgrades: Record<string, boolean>;
  purchasedCamos: CamoType[];
  equippedCamo: CamoType;
  unlockedTanks: TankModel[];
  stats: PlayerStats;
}

export interface ModuleState {
  trackLeft: number;
  trackRight: number;
  gun: number;
  engine: number;
}

export interface AmmoState {
  ap: number;
  heat: number;
  he: number;
  current: AmmoType;
}

export interface MinimapEntity {
  x: number;
  z: number;
  heading: number;
  isPlayer: boolean;
  isEnemy: boolean;
  dead: boolean;
}

export interface HudState {
  playerHealth: number;
  playerMaxHealth: number;
  botsAlive: number;
  botsTotal: number;
  kills: number;
  reloadPct: number;
  ready: boolean;
  speedKmh: number;
  hullHeadingDeg: number;
  turretHeadingDeg: number;
  barrelPitchDeg: number;
  damageFlash: number;
  targetName: string;
  targetHealth: number;
  targetMaxHealth: number;
  modules: ModuleState;
  ammo: AmmoState;
  magAmmo: number;
  magSize: number;
  minimapEntities: MinimapEntity[];
  pickupAlert: string;
}

export type GameResult = "win" | "lose" | null;

export interface GameStats {
  kills: number;
  damageDealt: number;
  accuracy: number;
  shotsFired: number;
  shotsHit: number;
  goldEarned: number;
  xpEarned: number;
  survived: boolean;
}
