import type { PlayerProgress, PlayerStats, CamoType } from "../types";

const KEY = "tanks_progress";

const EMPTY_STATS: PlayerStats = {
  totalKills: 0, totalDamage: 0, totalWins: 0, totalLosses: 0,
  totalGames: 0, totalShotsFired: 0, totalShotsHit: 0,
};

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PlayerProgress;
      return {
        xp: p.xp || 0,
        gold: p.gold || 0,
        upgrades: p.upgrades || {},
        goldUpgrades: p.goldUpgrades || {},
        purchasedCamos: (p.purchasedCamos || []) as CamoType[],
        equippedCamo: (p.equippedCamo || "") as CamoType,
        unlockedTanks: p.unlockedTanks?.length ? p.unlockedTanks : ["t34"],
        stats: { ...EMPTY_STATS, ...(p.stats || {}) },
      };
    }
  } catch { /* ignore */ }
  return { xp: 0, gold: 0, upgrades: {}, goldUpgrades: {}, purchasedCamos: [], equippedCamo: "", unlockedTanks: ["t34"], stats: { ...EMPTY_STATS } };
}

export function saveProgress(p: PlayerProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
