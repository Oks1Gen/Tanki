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
  reloadPct: number; // 0..1, 1 = ready
  ready: boolean;
  speedKmh: number;
  hullHeadingDeg: number; // 0 = north (+Z), clockwise
  turretHeadingDeg: number;
  barrelPitchDeg: number;
  damageFlash: number; // 0..1 transient
}

export type GameResult = "win" | "lose" | null;
