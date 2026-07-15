import type { PlayerProgress, PlayerStats, CamoType, TankModel } from "../types";
import { TANK_ORDER } from "../game/tanks";

const KEY = "tanks_progress";

const EMPTY_STATS: PlayerStats = {
  totalKills: 0, totalDamage: 0, totalWins: 0, totalLosses: 0,
  totalGames: 0, totalShotsFired: 0, totalShotsHit: 0,
};

const TANK_MODELS: TankModel[] = ["e100", "t34", "t100lt"];

function emptyPerTankUpgrades(): Record<TankModel, Record<string, number>> {
  return { e100: {}, t34: {}, t100lt: {} };
}

function normalizeUpgrades(raw: unknown): Record<TankModel, Record<string, number>> {
  const result = emptyPerTankUpgrades();
  if (!raw || typeof raw !== "object") return result;
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  const isPerTank = keys.length > 0 && keys.every((k) => TANK_MODELS.includes(k as TankModel));
  if (isPerTank) {
    for (const m of TANK_ORDER) {
      const v = r[m];
      result[m] = v && typeof v === "object" ? { ...(v as Record<string, number>) } : {};
    }
  } else {
    // Legacy flat format: previously-global upgrades are copied onto every tank
    const legacy = r as Record<string, number>;
    for (const m of TANK_MODELS) result[m] = { ...legacy };
  }
  return result;
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PlayerProgress;
      return {
        xp: p.xp || 0,
        gold: p.gold || 0,
        upgrades: normalizeUpgrades(p.upgrades),
        goldUpgrades: p.goldUpgrades || {},
        purchasedCamos: (p.purchasedCamos || []) as CamoType[],
        equippedCamo: (p.equippedCamo || "") as CamoType,
        unlockedTanks: p.unlockedTanks?.length ? p.unlockedTanks : ["t34"],
        stats: { ...EMPTY_STATS, ...(p.stats || {}) },
      };
    }
  } catch { /* ignore */ }
  return { xp: 0, gold: 0, upgrades: emptyPerTankUpgrades(), goldUpgrades: {}, purchasedCamos: [], equippedCamo: "", unlockedTanks: ["t34"], stats: { ...EMPTY_STATS } };
}

export function saveProgress(p: PlayerProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
