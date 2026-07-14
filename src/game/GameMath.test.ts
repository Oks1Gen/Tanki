import { describe, it, expect } from "vitest";
import { clamp, lerp, damp, normalizeAngle, angleDiff, rotateToward, forward } from "./GameMath";

describe("clamp", () => {
  it("returns v when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to min when v is below", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it("clamps to max when v is above", () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it("handles equal bounds", () => {
    expect(clamp(3, 5, 5)).toBe(5);
  });
  it("handles NaN as min/max", () => {
    expect(clamp(5, -Infinity, Infinity)).toBe(5);
  });
});

describe("lerp", () => {
  it("returns a when t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it("returns b when t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it("returns midpoint when t=0.5", () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
  it("extrapolates when t < 0", () => {
    expect(lerp(10, 20, -1)).toBe(0);
  });
  it("extrapolates when t > 1", () => {
    expect(lerp(10, 20, 2)).toBe(30);
  });
});

describe("damp", () => {
  it("returns a when dt=0", () => {
    expect(damp(10, 20, 5, 0)).toBeCloseTo(10);
  });
  it("approaches target over time", () => {
    const result = damp(0, 100, 2, 0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });
  it("reaches target with large dt", () => {
    expect(damp(0, 100, 5, 10)).toBeCloseTo(100, 1);
  });
  it("handles lambda=0 (no damping)", () => {
    expect(damp(10, 20, 0, 1)).toBeCloseTo(10);
  });
});

describe("normalizeAngle", () => {
  it("returns same for 0", () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });
  it("returns same for π", () => {
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
  });
  it("wraps 3π to π", () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
  it("wraps -π to -π", () => {
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI);
  });
  it("wraps -3π to -π", () => {
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
  });
  it("handles large angle", () => {
    expect(normalizeAngle(10 * Math.PI)).toBeCloseTo(0, 1);
  });
});

describe("angleDiff", () => {
  it("returns positive difference", () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
  it("returns negative difference", () => {
    expect(angleDiff(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2);
  });
  it("handles wrap-around", () => {
    const diff = angleDiff(0, 3 * Math.PI / 2);
    expect(diff).toBeCloseTo(-Math.PI / 2);
  });
  it("returns 0 for same angle", () => {
    expect(angleDiff(1, 1)).toBeCloseTo(0);
  });
});

describe("rotateToward", () => {
  it("rotates toward target within maxStep", () => {
    const result = rotateToward(0, Math.PI / 2, 0.5);
    expect(result).toBeCloseTo(0.5);
  });
  it("returns target when within maxStep", () => {
    const result = rotateToward(0, 0.3, 0.5);
    expect(result).toBeCloseTo(0.3);
  });
  it("rotates negative direction", () => {
    const result = rotateToward(0, -Math.PI / 2, 0.5);
    expect(result).toBeCloseTo(-0.5);
  });
  it("returns same when already at target", () => {
    const result = rotateToward(1, 1, 0.5);
    expect(result).toBeCloseTo(1);
  });
});

describe("forward", () => {
  it("returns {x: 0, y: 1} for angle 0", () => {
    const f = forward(0);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(1);
  });
  it("returns {x: 1, y: 0} for π/2", () => {
    const f = forward(Math.PI / 2);
    expect(f.x).toBeCloseTo(1);
    expect(f.y).toBeCloseTo(0);
  });
  it("returns {x: 0, y: -1} for π", () => {
    const f = forward(Math.PI);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(-1);
  });
  it("returns {x: -1, y: 0} for 3π/2", () => {
    const f = forward(3 * Math.PI / 2);
    expect(f.x).toBeCloseTo(-1);
    expect(f.y).toBeCloseTo(0);
  });
});
