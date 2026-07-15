import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadProgress, saveProgress } from "./progress";

const KEY = "tanks_progress";

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
});

beforeEach(() => {
  localStorage.clear();
});

describe("loadProgress", () => {
  it("returns default progress when nothing stored", () => {
    const p = loadProgress();
    expect(p.xp).toBe(0);
    expect(p.gold).toBe(0);
    expect(p.upgrades).toEqual({ e100: {}, t34: {}, t100lt: {} });
    expect(p.goldUpgrades).toEqual({});
    expect(p.purchasedCamos).toEqual([]);
    expect(p.equippedCamo).toBe("");
    expect(p.unlockedTanks).toEqual(["t34"]);
    expect(p.stats.totalKills).toBe(0);
  });

  it("loads stored progress", () => {
    const data = { xp: 100, gold: 50, upgrades: { gun: 1 }, goldUpgrades: {}, purchasedCamos: ["forest"], equippedCamo: "forest", unlockedTanks: ["t34", "t100lt"], stats: { totalKills: 5, totalDamage: 100, totalWins: 1, totalLosses: 2, totalGames: 3, totalShotsFired: 50, totalShotsHit: 25 } };
    localStorage.setItem(KEY, JSON.stringify(data));
    const p = loadProgress();
    expect(p.xp).toBe(100);
    expect(p.gold).toBe(50);
    expect(p.upgrades).toEqual({ e100: { gun: 1 }, t34: { gun: 1 }, t100lt: { gun: 1 } });
    expect(p.purchasedCamos).toEqual(["forest"]);
    expect(p.unlockedTanks).toEqual(["t34", "t100lt"]);
    expect(p.stats.totalKills).toBe(5);
  });

  it("returns default on corrupt JSON", () => {
    localStorage.setItem(KEY, "not-json");
    const p = loadProgress();
    expect(p.xp).toBe(0);
  });

  it("handles partial data with defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ xp: 200 }));
    const p = loadProgress();
    expect(p.xp).toBe(200);
    expect(p.gold).toBe(0);
    expect(p.unlockedTanks).toEqual(["t34"]);
  });

  it("preserves stored unlockedTanks when present", () => {
    localStorage.setItem(KEY, JSON.stringify({ unlockedTanks: ["t34", "e100"], xp: 5000 }));
    const p = loadProgress();
    expect(p.unlockedTanks).toEqual(["t34", "e100"]);
  });

  it("uses default unlockedTanks when empty array", () => {
    localStorage.setItem(KEY, JSON.stringify({ unlockedTanks: [], xp: 0 }));
    const p = loadProgress();
    expect(p.unlockedTanks).toEqual(["t34"]);
  });

  it("merges partial stats with defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ stats: { totalKills: 10 } }));
    const p = loadProgress();
    expect(p.stats.totalKills).toBe(10);
    expect(p.stats.totalDamage).toBe(0);
    expect(p.stats.totalWins).toBe(0);
  });
});

describe("saveProgress", () => {
  it("writes to localStorage", () => {
    const p = loadProgress();
    p.xp = 999;
    saveProgress(p);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.xp).toBe(999);
  });

  it("stores all fields", () => {
    const p = loadProgress();
    p.gold = 300;
    p.upgrades = { e100: { gun: 2 }, t34: {}, t100lt: {} };
    saveProgress(p);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.gold).toBe(300);
    expect(stored.upgrades).toEqual({ e100: { gun: 2 }, t34: {}, t100lt: {} });
    expect(stored.unlockedTanks).toEqual(["t34"]);
  });
});
