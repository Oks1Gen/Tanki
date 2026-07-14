export type TankModel = "e100" | "t34" | "t100lt";

export interface GameSettings {
  tankModel: TankModel;
  botCount: number;
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
}

export type GameResult = "win" | "lose" | null;
