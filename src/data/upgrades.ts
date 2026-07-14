import type { UpgradeDef, TankModel, CamoType } from "../types";

export const UPGRADES: UpgradeDef[] = [
  {
    id: "gun",
    name: "Орудие",
    desc: "Увеличение урона орудия",
    icon: "\u{1F52B}",
    maxLevel: 3,
    levels: [
      { xpCost: 200, label: "+10% урон" },
      { xpCost: 500, label: "+20% урон" },
      { xpCost: 1000, label: "+30% урон" },
    ],
  },
  {
    id: "engine",
    name: "Двигатель",
    desc: "Увеличение скорости",
    icon: "\u26A1",
    maxLevel: 3,
    levels: [
      { xpCost: 200, label: "+8% скорость" },
      { xpCost: 500, label: "+16% скорость" },
      { xpCost: 1000, label: "+24% скорость" },
    ],
  },
  {
    id: "armor",
    name: "Броня",
    desc: "Увеличение прочности",
    icon: "\u{1F6E1}",
    maxLevel: 2,
    levels: [
      { xpCost: 300, label: "+10% прочность" },
      { xpCost: 700, label: "+20% прочность" },
    ],
  },
  {
    id: "optics",
    name: "Прицел",
    desc: "Скорость поворота башни",
    icon: "\u{1F50D}",
    maxLevel: 2,
    levels: [
      { xpCost: 200, label: "+15% поворот башни" },
      { xpCost: 500, label: "+30% поворот башни" },
    ],
  },
  {
    id: "ammo",
    name: "Боеукладка",
    desc: "Увеличение боекомплекта",
    icon: "\u{1F9F0}",
    maxLevel: 2,
    levels: [
      { xpCost: 200, label: "+15% снарядов" },
      { xpCost: 500, label: "+30% снарядов" },
    ],
  },
  {
    id: "tracks",
    name: "Ходовая",
    desc: "Скорость поворота корпуса",
    icon: "\u2699",
    maxLevel: 3,
    levels: [
      { xpCost: 200, label: "+10% поворот корпуса" },
      { xpCost: 500, label: "+20% поворот корпуса" },
      { xpCost: 1000, label: "+30% поворот корпуса" },
    ],
  },
];

export const GOLD_UPGRADES: { id: string; label: string; desc: string; tankModel: TankModel; goldCost: number; icon: string }[] = [
  { id: "t34_drum", label: "Орудие барабана (Т-34)", desc: "Магазин 3 снаряда, +80% перезарядка, +40% урон", tankModel: "t34", goldCost: 300, icon: "\u{1F3F9}" },
  { id: "t100lt_drum", label: "Орудие барабана (Т-100 ЛТ)", desc: "Магазин 3 снаряда, +80% перезарядка, +40% урон", tankModel: "t100lt", goldCost: 300, icon: "\u{1F3F9}" },
  { id: "e100_enhanced", label: "Усиленное орудие (E 100)", desc: "+60% урон", tankModel: "e100", goldCost: 500, icon: "\u{1F525}" },
];

export const CAMO_COLORS: Record<CamoType, number> = {
  "": 0x278fe8,
  forest: 0x3d6b2e,
  desert: 0x9a8b4a,
  winter: 0xf0f0f0,
};

export const CAMO_ITEMS: { type: CamoType; label: string; goldCost: number }[] = [
  { type: "forest", label: "Лесной камуфляж", goldCost: 200 },
  { type: "desert", label: "Пустынный камуфляж", goldCost: 200 },
  { type: "winter", label: "Зимний камуфляж", goldCost: 200 },
];

export const TANK_UNLOCKS: { model: TankModel; name: string; xpCost: number }[] = [
  { model: "t34", name: "Т-34", xpCost: 0 },
  { model: "t100lt", name: "Т-100 ЛТ", xpCost: 2000 },
  { model: "e100", name: "E 100", xpCost: 5000 },
];

export function computeUpgradeEffects(upgrades: Record<string, number>, goldUpgrades?: Record<string, boolean>, tankModel?: string): Record<string, number> {
  const e: Record<string, number> = {};
  const gunLvl = upgrades.gun || 0;
  const engineLvl = upgrades.engine || 0;
  const armorLvl = upgrades.armor || 0;
  const opticsLvl = upgrades.optics || 0;
  const ammoLvl = upgrades.ammo || 0;
  const tracksLvl = upgrades.tracks || 0;
  e.damageMul = 1 + gunLvl * 0.1;
  e.speedMul = 1 + engineLvl * 0.08;
  e.healthMul = 1 + armorLvl * 0.1;
  e.turretRotMul = 1 + opticsLvl * 0.15;
  e.ammoCapacity = 1 + ammoLvl * 0.15;
  e.hullRotMul = 1 + tracksLvl * 0.1;

  if (goldUpgrades && tankModel) {
    if ((tankModel === "t34" && goldUpgrades.t34_drum) || (tankModel === "t100lt" && goldUpgrades.t100lt_drum)) {
      e.magazineSize = 3;
      e.reloadMul = 1.8;
      e.damageMul = (e.damageMul || 1) * 1.4;
    }
    if (tankModel === "e100" && goldUpgrades.e100_enhanced) {
      e.damageMul = (e.damageMul || 1) * 1.6;
    }
  }
  return e;
}
