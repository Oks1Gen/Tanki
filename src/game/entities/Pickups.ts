import * as THREE from "three";
import type { Pickup as PickupType } from "../GameTypes";
import { MAP_HALF } from "../../constants";

const PICKUP_COUNT = 10;
const RESPAWN_TIME = 15;

export function createPickupManager(scene: THREE.Scene, pointBlocked: (x: number, z: number, pad: number) => boolean) {
  const pickups: PickupType[] = [];
  const timers: number[] = [];

  function buildMesh(type: string): THREE.Object3D {
    const group = new THREE.Group();
    if (type === "repair") {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.6 }));
      cross.position.y = 0.9; group.add(cross);
      const cross2 = cross.clone(); cross2.rotation.z = Math.PI / 2; cross2.position.y = 0.9; group.add(cross2);
    } else if (type === "speed") {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.6 }));
      arrow.position.y = 1; arrow.rotation.y = Math.PI / 4; group.add(arrow);
    } else if (type === "damage") {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 }));
      star.position.y = 0.9; group.add(star);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xcc8800, emissive: 0xcc8800, emissiveIntensity: 0.4 }));
      box.position.y = 0.7; group.add(box);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 0.3 }));
      band.position.set(0, 0.5, 0.38); group.add(band);
      const band2 = band.clone(); band2.position.set(0, 0.9, 0.38); group.add(band2);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.5; group.add(glow);
    return group;
  }

  function findSpawn(): [number, number] | null {
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * MAP_HALF * 1.6;
      const z = (Math.random() - 0.5) * MAP_HALF * 1.6;
      if (Math.hypot(x, z) < 12) continue;
      if (pointBlocked(x, z, 1.5)) continue;
      let tooClose = false;
      for (const p of pickups) { if (p.active && Math.hypot(p.group.position.x - x, p.group.position.z - z) < 8) { tooClose = true; break; } }
      if (tooClose) continue;
      return [x, z];
    }
    return [Math.random() * 40 - 20, Math.random() * 40 - 20];
  }

  function spawnPickup() {
    const types = ["repair", "speed", "damage", "ammo"] as const;
    const type = types[Math.floor(Math.random() * 4)];
    const pos = findSpawn();
    if (!pos) return;
    const mesh = buildMesh(type);
    mesh.position.set(pos[0], 0, pos[1]);
    scene.add(mesh);
    pickups.push({ group: mesh, type, radius: 1.8, active: true });
  }

  function init() {
    for (let i = 0; i < PICKUP_COUNT; i++) spawnPickup();
  }

  function update(dt: number, tankPositions: { x: number; z: number }[], onPickup: (type: string) => void) {
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i] -= dt;
      if (timers[i] <= 0) { timers.splice(i, 1); spawnPickup(); }
    }
    for (const p of pickups) {
      if (!p.active) continue;
      p.group.rotation.y += dt * 1.2;
      p.group.position.y = 0.4 + Math.sin(Date.now() * 0.004) * 0.15;
      for (const pos of tankPositions) {
        if (Math.hypot(p.group.position.x - pos.x, p.group.position.z - pos.z) < p.radius) {
          p.active = false;
          p.group.visible = false;
          onPickup(p.type);
          timers.push(RESPAWN_TIME);
          break;
        }
      }
    }
  }

  function reset() {
    for (const p of pickups) { scene.remove(p.group); }
    pickups.length = 0;
    timers.length = 0;
    init();
  }

  return { init, update, reset, pickups };
}
