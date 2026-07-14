import { describe, it, expect, vi } from "vitest";
import { createDestructibleManager } from "./Destructibles";

function makeObstacle(destructible = false, hp?: number) {
  return {
    box: {} as any,
    mesh: { visible: true } as any,
    destructible,
    hp,
    maxHp: hp,
  };
}

describe("createDestructibleManager", () => {
  it("marks obstacle as destructible", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle();
    mgr.markDestructible(o, 100);
    expect(o.destructible).toBe(true);
    expect(o.hp).toBe(100);
    expect(o.maxHp).toBe(100);
  });

  it("damage reduces hp", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle();
    mgr.markDestructible(o, 100);
    mgr.damage(o, 30, vi.fn());
    expect(o.hp).toBe(70);
  });

  it("damage triggers onDestroy when hp <= 0", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle();
    mgr.markDestructible(o, 50);
    const onDestroy = vi.fn();
    const result = mgr.damage(o, 60, onDestroy);
    expect(result).toBe(true);
    expect(onDestroy).toHaveBeenCalledWith(o);
  });

  it("damage returns false for non-destructible", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle(false);
    const result = mgr.damage(o, 10, vi.fn());
    expect(result).toBe(false);
  });

  it("accumulates multiple damage calls", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle();
    mgr.markDestructible(o, 100);
    mgr.damage(o, 30, vi.fn());
    mgr.damage(o, 20, vi.fn());
    expect(o.hp).toBe(50);
  });

  it("exact damage to zero triggers onDestroy", () => {
    const mgr = createDestructibleManager();
    const o = makeObstacle();
    mgr.markDestructible(o, 40);
    const onDestroy = vi.fn();
    mgr.damage(o, 40, onDestroy);
    expect(onDestroy).toHaveBeenCalled();
  });
});
