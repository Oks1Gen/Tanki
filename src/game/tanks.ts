import type { TankModel } from "../types";

export interface TankSpec {
  id: TankModel;
  name: string;
  role: string;
  hull: { width: number; length: number; height: number };
  track: { width: number; height: number };
  turret: {
    type: "box" | "round" | "flat";
    radius: number;
    width: number;
    length: number;
    height: number;
  };
  barrel: { length: number; radius: number };
  stats: { armor: number; speed: number; damage: number; reload: number };
  maxSpeed: number;
  rotSpeed: number;
  turretRotSpeed: number;
  reloadTime: number;
  shellSpeed: number;
  damage: number;
  maxHealth: number;
  magazineSize: number;
}

export const TANK_SPECS: Record<TankModel, TankSpec> = {
  e100: {
    id: "e100", name: "E 100", role: "Тяжёлый танк",
    hull: { width: 4.4, length: 7.2, height: 1.05 },
    track: { width: 0.95, height: 0.95 },
    turret: { type: "box", radius: 2.2, width: 3.7, length: 4.4, height: 1.35 },
    barrel: { length: 4.8, radius: 0.45 },
    stats: { armor: 0.95, speed: 0.25, damage: 0.95, reload: 0.2 },
    maxSpeed: 9, rotSpeed: 0.75, turretRotSpeed: 1.0, reloadTime: 3.4, shellSpeed: 70, damage: 380, maxHealth: 2900, magazineSize: 1,
  },
  t34: {
    id: "t34", name: "Т-34", role: "Средний танк",
    hull: { width: 3.0, length: 5.6, height: 0.92 },
    track: { width: 0.7, height: 0.8 },
    turret: { type: "round", radius: 1.55, width: 3.0, length: 3.0, height: 0.95 },
    barrel: { length: 3.7, radius: 0.23 },
    stats: { armor: 0.55, speed: 0.62, damage: 0.6, reload: 0.55 },
    maxSpeed: 16, rotSpeed: 1.5, turretRotSpeed: 2.1, reloadTime: 2.1, shellSpeed: 88, damage: 240, maxHealth: 1500, magazineSize: 1,
  },
  t100lt: {
    id: "t100lt", name: "Т-100 ЛТ", role: "Лёгкий танк",
    hull: { width: 2.8, length: 5.9, height: 0.78 },
    track: { width: 0.62, height: 0.72 },
    turret: { type: "flat", radius: 1.4, width: 2.3, length: 2.7, height: 0.62 },
    barrel: { length: 4.0, radius: 0.16 },
    stats: { armor: 0.3, speed: 0.95, damage: 0.4, reload: 0.9 },
    maxSpeed: 27, rotSpeed: 2.1, turretRotSpeed: 3.1, reloadTime: 1.35, shellSpeed: 102, damage: 170, maxHealth: 950, magazineSize: 1,
  },
};

export const TANK_ORDER: TankModel[] = ["e100", "t34", "t100lt"];

export type { TankMesh } from "./tank-mesh";
export { createTankMesh } from "./tank-mesh";
