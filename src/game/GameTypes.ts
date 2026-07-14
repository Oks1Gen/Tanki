import * as THREE from "three";
import type { TankSpec } from "./tanks";
import type { TankMesh } from "./tank-mesh";
import type { GameResult, HudState, AmmoType, ModuleState, AmmoState, GameStats } from "../types";

export interface Obstacle {
  box: THREE.Box3;
  mesh: THREE.Object3D;
  destructible?: boolean;
  hp?: number;
  maxHp?: number;
}

export interface Tank {
  spec: TankSpec;
  mesh: TankMesh;
  hullAngle: number;
  turretAngle: number;
  velocity: number;
  health: number;
  reload: number;
  recoil: number;
  isPlayer: boolean;
  dead: boolean;
  radius: number;
  aiWander: number;
  aiTimer: number;
  aiTarget: Tank | null;
  targetTimer: number;
  blocked: number;
  barrelPitch: number;
  modules: ModuleState;
  ammo: AmmoState;
  speedBoost: number;
  damageBoost: number;
  trackLeftTimer: number;
  trackRightTimer: number;
  trackLeftHits: number;
  trackRightHits: number;
  hpBarCanvas?: HTMLCanvasElement;
  hpBarCtx?: CanvasRenderingContext2D;
  hpBarTexture?: THREE.CanvasTexture;
  hpBarSprite?: THREE.Sprite;
  hpBarLastHp?: number;
  hpBarDirty?: boolean;
  magazineAmmo: number;
  magazineSize: number;
  reloadMul: number;
  damageMul: number;
  speedMul: number;
  turretRotMul: number;
  hullRotMul: number;
}

export interface Shell {
  group: THREE.Group;
  vel: THREE.Vector3;
  life: number;
  owner: Tank;
  damage: number;
  type: AmmoType;
}

export interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
}

export interface Effect {
  group: THREE.Group;
  age: number;
  life: number;
  light: THREE.PointLight | null;
  sparks: Spark[];
  grow: THREE.Mesh[];
  update: (dt: number) => boolean;
}

export interface Pickup {
  group: THREE.Object3D;
  type: "repair" | "speed" | "damage" | "ammo";
  radius: number;
  active: boolean;
}

export interface GameCallbacks {
  onHud: (s: HudState) => void;
  onEnd: (r: GameResult, stats?: GameStats) => void;
  onPause: (paused: boolean) => void;
  onAim: (x: number, y: number) => void;
}
