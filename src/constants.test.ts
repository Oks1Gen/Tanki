import { describe, it, expect } from "vitest";
import { MAP_HALF, RECOIL, FIRE_RANGE } from "./constants";

describe("constants", () => {
  it("MAP_HALF is 110", () => {
    expect(MAP_HALF).toBe(110);
  });
  it("RECOIL is 0.7", () => {
    expect(RECOIL).toBe(0.7);
  });
  it("FIRE_RANGE is 170", () => {
    expect(FIRE_RANGE).toBe(170);
  });
});
