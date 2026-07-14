import { describe, it, expect } from "vitest";
import { UPGRADES, GOLD_UPGRADES, CAMO_COLORS, CAMO_ITEMS, TANK_UNLOCKS, computeUpgradeEffects } from "./upgrades";

describe("UPGRADES data integrity", () => {
  it("has 6 upgrades", () => {
    expect(UPGRADES).toHaveLength(6);
  });
  it("each upgrade has unique id", () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each upgrade has matching levels count and maxLevel", () => {
    for (const u of UPGRADES) {
      expect(u.levels).toHaveLength(u.maxLevel);
    }
  });
  it("each level has positive xpCost", () => {
    for (const u of UPGRADES) {
      for (const l of u.levels) {
        expect(l.xpCost).toBeGreaterThan(0);
      }
    }
  });
});

describe("GOLD_UPGRADES data integrity", () => {
  it("has 3 gold upgrades", () => {
    expect(GOLD_UPGRADES).toHaveLength(3);
  });
  it("each has unique id", () => {
    const ids = GOLD_UPGRADES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each has positive goldCost", () => {
    for (const g of GOLD_UPGRADES) {
      expect(g.goldCost).toBeGreaterThan(0);
    }
  });
});

describe("CAMO data integrity", () => {
  it("CAMO_COLORS has 4 entries", () => {
    expect(Object.keys(CAMO_COLORS)).toHaveLength(4);
  });
  it("CAMO_ITEMS has 3 purchasable camos", () => {
    expect(CAMO_ITEMS).toHaveLength(3);
  });
  it("each camo item has positive goldCost", () => {
    for (const c of CAMO_ITEMS) {
      expect(c.goldCost).toBeGreaterThan(0);
    }
  });
});

describe("TANK_UNLOCKS data integrity", () => {
  it("has 3 tank unlocks", () => {
    expect(TANK_UNLOCKS).toHaveLength(3);
  });
  it("t34 is free", () => {
    const t34 = TANK_UNLOCKS.find((u) => u.model === "t34");
    expect(t34?.xpCost).toBe(0);
  });
  it("has increasing xp costs", () => {
    const costs = TANK_UNLOCKS.filter((u) => u.xpCost > 0).map((u) => u.xpCost);
    expect(costs).toEqual(costs.slice().sort((a, b) => a - b));
  });
});

describe("computeUpgradeEffects", () => {
  it("returns all 1s with no upgrades", () => {
    const e = computeUpgradeEffects({});
    expect(e.damageMul).toBe(1);
    expect(e.speedMul).toBe(1);
    expect(e.healthMul).toBe(1);
    expect(e.turretRotMul).toBe(1);
    expect(e.ammoCapacity).toBe(1);
    expect(e.hullRotMul).toBe(1);
  });

  it("scales damage with gun level", () => {
    const e = computeUpgradeEffects({ gun: 3 });
    expect(e.damageMul).toBe(1.3);
  });

  it("scales speed with engine level", () => {
    const e = computeUpgradeEffects({ engine: 2 });
    expect(e.speedMul).toBe(1.16);
  });

  it("scales health with armor level", () => {
    const e = computeUpgradeEffects({ armor: 2 });
    expect(e.healthMul).toBe(1.2);
  });

  it("applies gold drum upgrade for t34", () => {
    const e = computeUpgradeEffects({ gun: 1 }, { t34_drum: true }, "t34");
    expect(e.magazineSize).toBe(3);
    expect(e.reloadMul).toBe(1.8);
    expect(e.damageMul).toBeCloseTo(1.1 * 1.4);
  });

  it("applies gold drum upgrade for t100lt", () => {
    const e = computeUpgradeEffects({}, { t100lt_drum: true }, "t100lt");
    expect(e.magazineSize).toBe(3);
    expect(e.damageMul).toBe(1.4);
  });

  it("applies gold enhanced upgrade for e100", () => {
    const e = computeUpgradeEffects({}, { e100_enhanced: true }, "e100");
    expect(e.damageMul).toBe(1.6);
  });

  it("ignores gold upgrades for wrong tank model", () => {
    const e = computeUpgradeEffects({}, { t34_drum: true, e100_enhanced: true }, "t100lt");
    expect(e.magazineSize).toBeUndefined();
    expect(e.reloadMul).toBeUndefined();
    expect(e.damageMul).toBe(1);
  });

  it("handles undefined goldUpgrades", () => {
    const e = computeUpgradeEffects({ gun: 1 }, undefined, "t34");
    expect(e.damageMul).toBe(1.1);
    expect(e.magazineSize).toBeUndefined();
  });

  it("handles undefined tankModel", () => {
    const e = computeUpgradeEffects({}, { t34_drum: true });
    expect(e.magazineSize).toBeUndefined();
  });

  it("combines all max upgrades", () => {
    const e = computeUpgradeEffects({ gun: 3, engine: 3, armor: 2, optics: 2, ammo: 2, tracks: 3 });
    expect(e.damageMul).toBe(1.3);
    expect(e.speedMul).toBe(1.24);
    expect(e.healthMul).toBe(1.2);
    expect(e.turretRotMul).toBe(1.3);
    expect(e.ammoCapacity).toBe(1.3);
    expect(e.hullRotMul).toBe(1.3);
  });
});
