import { describe, it, expect, vi } from "vitest";

vi.mock("three", () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Vector2 {
    x: number; y: number;
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    clone() { return new Vector2(this.x, this.y); }
  }
  class Box3 {
    min: Vector3; max: Vector3;
    constructor(min?: Vector3, max?: Vector3) {
      this.min = min?.clone() ?? new Vector3(-1, -1, -1);
      this.max = max?.clone() ?? new Vector3(1, 1, 1);
    }
    clone() { return new Box3(this.min.clone(), this.max.clone()); }
    expandByScalar(s: number) {
      this.min.x -= s; this.min.y -= s; this.min.z -= s;
      this.max.x += s; this.max.y += s; this.max.z += s;
      return this;
    }
    containsPoint(p: Vector3) {
      return p.x >= this.min.x && p.x <= this.max.x
        && p.y >= this.min.y && p.y <= this.max.y
        && p.z >= this.min.z && p.z <= this.max.z;
    }
  }
  return { Vector3, Vector2, Box3 };
});

import { resolveCollision, pointBlocked, lineOfSight } from "./Collision";

function makeBox(minX: number, minZ: number, maxX: number, maxZ: number, minY = 0, maxY = 3) {
  const { Vector3, Box3 } = require("three");
  return {
    box: new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ)),
    mesh: { visible: true },
  };
}

describe("resolveCollision", () => {
  it("does not move pos when no obstacles", () => {
    const { Vector2 } = require("three");
    const pos = new Vector2(10, 10);
    resolveCollision(pos, 2, []);
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(10);
  });

  it("pushes pos out of obstacle", () => {
    const { Vector2 } = require("three");
    const obs = makeBox(-5, -5, 5, 5);
    const pos = new Vector2(0, 0);
    resolveCollision(pos, 1, [obs]);
    expect(pos.x).toBe(-6);
    expect(pos.y).toBe(0);
  });

  it("clamps to map boundary", () => {
    const { Vector2 } = require("three");
    const pos = new Vector2(100, 0);
    resolveCollision(pos, 2, []);
    expect(pos.x).toBe(76);
  });
});

describe("pointBlocked", () => {
  it("returns true when point is inside obstacle", () => {
    const obs = makeBox(-10, -10, 10, 10);
    expect(pointBlocked(0, 0, 0, [obs])).toBe(true);
  });

  it("returns false when point is outside obstacle", () => {
    const obs = makeBox(-10, -10, 10, 10);
    expect(pointBlocked(20, 20, 0, [obs])).toBe(false);
  });

  it("returns true with padding", () => {
    const obs = makeBox(5, 5, 10, 10);
    expect(pointBlocked(4.5, 6, 0.6, [obs])).toBe(true);
  });

  it("returns false with no obstacles", () => {
    expect(pointBlocked(0, 0, 1, [])).toBe(false);
  });
});

describe("lineOfSight", () => {
  it("returns true with no obstacles", () => {
    expect(lineOfSight(0, 0, 100, 0, [])).toBe(true);
  });

  it("returns false when obstacle blocks", () => {
    const obs = makeBox(-2, -2, 2, 2, 0, 3);
    expect(lineOfSight(-10, 0, 10, 0, [obs])).toBe(false);
  });

  it("returns true when obstacle is too low", () => {
    const obs = makeBox(-2, -2, 2, 2, -1, 0.5);
    expect(lineOfSight(-10, 0, 10, 0, [obs])).toBe(true);
  });
});
