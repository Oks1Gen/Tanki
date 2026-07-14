import type { Obstacle } from "../GameTypes";

export function createDestructibleManager() {
  function markDestructible(o: Obstacle, hp: number) {
    o.destructible = true;
    o.hp = hp;
    o.maxHp = hp;
  }

  function damage(o: Obstacle, dmg: number, onDestroy: (o: Obstacle) => void) {
    if (!o.destructible || o.hp === undefined) return false;
    o.hp -= dmg;
    if (o.hp <= 0) {
      onDestroy(o);
      return true;
    }
    return false;
  }

  return { markDestructible, damage };
}
