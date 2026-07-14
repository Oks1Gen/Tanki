import { describe, it, expect } from "vitest";
import { TANK_SPECS, TANK_ORDER } from "./tanks";

describe("TANK_ORDER", () => {
  it("has 3 tanks", () => {
    expect(TANK_ORDER).toHaveLength(3);
  });
  it("contains valid tank models", () => {
    for (const id of TANK_ORDER) {
      expect(TANK_SPECS[id]).toBeDefined();
    }
  });
});

describe("TANK_SPECS", () => {
  it("has 3 tank specs", () => {
    expect(Object.keys(TANK_SPECS)).toHaveLength(3);
  });

  it("each tank has all required fields", () => {
    for (const [id, spec] of Object.entries(TANK_SPECS)) {
      expect(spec.id).toBe(id);
      expect(spec.name).toBeTruthy();
      expect(spec.maxHealth).toBeGreaterThan(0);
      expect(spec.maxSpeed).toBeGreaterThan(0);
      expect(spec.damage).toBeGreaterThan(0);
      expect(spec.reloadTime).toBeGreaterThan(0);
      expect(spec.shellSpeed).toBeGreaterThan(0);
      expect(spec.rotSpeed).toBeGreaterThan(0);
      expect(spec.turretRotSpeed).toBeGreaterThan(0);
      expect(spec.magazineSize).toBeGreaterThanOrEqual(1);
      expect(spec.hull.width).toBeGreaterThan(0);
      expect(spec.hull.length).toBeGreaterThan(0);
      expect(spec.hull.height).toBeGreaterThan(0);
      expect(spec.track.width).toBeGreaterThan(0);
      expect(spec.track.height).toBeGreaterThan(0);
      expect(spec.barrel.length).toBeGreaterThan(0);
      expect(spec.barrel.radius).toBeGreaterThan(0);
    }
  });

  it("e100 is the heaviest (most health)", () => {
    const e100 = TANK_SPECS.e100;
    const t34 = TANK_SPECS.t34;
    const t100lt = TANK_SPECS.t100lt;
    expect(e100.maxHealth).toBeGreaterThan(t34.maxHealth);
    expect(t34.maxHealth).toBeGreaterThan(t100lt.maxHealth);
  });

  it("t100lt is the fastest", () => {
    const t100lt = TANK_SPECS.t100lt;
    const t34 = TANK_SPECS.t34;
    const e100 = TANK_SPECS.e100;
    expect(t100lt.maxSpeed).toBeGreaterThan(t34.maxSpeed);
    expect(t34.maxSpeed).toBeGreaterThan(e100.maxSpeed);
  });

  it("e100 has the most damage", () => {
    expect(TANK_SPECS.e100.damage).toBeGreaterThan(TANK_SPECS.t34.damage);
    expect(TANK_SPECS.t34.damage).toBeGreaterThan(TANK_SPECS.t100lt.damage);
  });
});
