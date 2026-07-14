import { useState, useCallback } from "react";
import type { GameSettings, CamoType, TankModel } from "./types";
import Menu from "./components/Menu";
import GameView from "./components/GameView";
import ErrorBoundary from "./errors/ErrorBoundary";
import { loadProgress, saveProgress } from "./utils/progress";
import { UPGRADES, TANK_UNLOCKS, GOLD_UPGRADES, CAMO_ITEMS } from "./data/upgrades";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [runId, setRunId] = useState(0);
  const [progress, setProgress] = useState(() => loadProgress());

  const addGold = useCallback((gold: number) => {
    setProgress((p) => {
      const next = { ...p, gold: p.gold + gold };
      saveProgress(next);
      return next;
    });
  }, []);

  const addXpAndStats = useCallback((xp: number, result: "win" | "lose", stats: { kills: number; damage: number; shotsFired: number; shotsHit: number }) => {
    setProgress((p) => {
      const next = {
        ...p,
        xp: p.xp + xp,
        stats: {
          totalKills: p.stats.totalKills + stats.kills,
          totalDamage: p.stats.totalDamage + stats.damage,
          totalWins: p.stats.totalWins + (result === "win" ? 1 : 0),
          totalLosses: p.stats.totalLosses + (result === "lose" ? 1 : 0),
          totalGames: p.stats.totalGames + 1,
          totalShotsFired: p.stats.totalShotsFired + stats.shotsFired,
          totalShotsHit: p.stats.totalShotsHit + stats.shotsHit,
        },
        unlockedTanks: checkUnlocks(p.xp + xp, p.unlockedTanks),
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const checkUnlocks = useCallback((totalXp: number, current: TankModel[]): TankModel[] => {
    const result = [...current];
    for (const unlock of TANK_UNLOCKS) {
      if (unlock.xpCost > 0 && !result.includes(unlock.model) && totalXp >= unlock.xpCost) {
        result.push(unlock.model);
      }
    }
    return result;
  }, []);

  const buyUpgrade = useCallback((id: string) => {
    setProgress((p) => {
      // Gold upgrade purchase
      if (id.startsWith("gold_")) {
        const goldId = id.slice(5);
        const def = GOLD_UPGRADES.find((g) => g.id === goldId);
        if (!def || p.goldUpgrades[goldId] || p.gold < def.goldCost) return p;
        const next = { ...p, gold: p.gold - def.goldCost, goldUpgrades: { ...p.goldUpgrades, [goldId]: true } };
        saveProgress(next);
        return next;
      }

      // Accelerate - spend gold for XP
      if (id.startsWith("accelerate_")) {
        const upId = id.slice(11);
        const def = UPGRADES.find((u) => u.id === upId);
        if (!def) return p;
        const level = (p.upgrades[upId] || 0) + 1;
        if (level > def.maxLevel) return p;
        const xpCost = def.levels[level - 1].xpCost;
        const goldNeeded = Math.ceil(xpCost / 10);
        if (p.gold < goldNeeded) return p;
        const next = { ...p, gold: p.gold - goldNeeded, upgrades: { ...p.upgrades, [upId]: level } };
        saveProgress(next);
        return next;
      }

      // Camo purchase
      if (id.startsWith("camo_")) {
        const camoType = id.slice(5) as CamoType;
        if (!camoType || p.purchasedCamos.includes(camoType)) return p;
        const def = CAMO_ITEMS.find((c) => c.type === camoType);
        if (!def || p.gold < def.goldCost) return p;
        const next = { ...p, gold: p.gold - def.goldCost, purchasedCamos: [...p.purchasedCamos, camoType], equippedCamo: camoType };
        saveProgress(next);
        return next;
      }

      // Equip camo
      if (id.startsWith("equipCamo_")) {
        const camoType = id.slice(10) as CamoType;
        if (camoType === "" || p.purchasedCamos.includes(camoType)) {
          const next = { ...p, equippedCamo: camoType };
          saveProgress(next);
          return next;
        }
        return p;
      }

      // XP upgrade purchase
      {
        const level = (p.upgrades[id] || 0) + 1;
        const def = UPGRADES.find((u) => u.id === id);
        if (!def || level > def.maxLevel) return p;
        const cost = def.levels[level - 1].xpCost;
        if (p.xp < cost) return p;
        const next = { ...p, xp: p.xp - cost, upgrades: { ...p.upgrades, [id]: level } };
        saveProgress(next);
        return next;
      }
    });
  }, []);

  const startGame = (s: GameSettings) => {
    setSettings(s);
    setRunId((n) => n + 1);
    setScreen("game");
  };

  if (screen === "game" && settings) {
    return (
      <ErrorBoundary key={runId}>
        <GameView
          settings={settings}
          onExit={() => setScreen("menu")}
          onRestart={() => setRunId((n) => n + 1)}
          onGoldEarned={addGold}
          onXpEarned={addXpAndStats}
        />
      </ErrorBoundary>
    );
  }

  return <Menu progress={progress} onStart={startGame} onBuy={buyUpgrade} />;
}
