import * as THREE from "three";
import { MAP_HALF } from "../../constants";
import { clamp } from "../GameMath";
import type { Obstacle } from "../GameTypes";

export function resolveCollision(pos: THREE.Vector2, radius: number, obstacles: Obstacle[]) {
  for (const o of obstacles) {
    const orig = o.box;
    const expanded = orig.clone().expandByScalar(radius);
    if (expanded.containsPoint(new THREE.Vector3(pos.x, 1, pos.y))) {
      const dl = pos.x - orig.min.x + radius;
      const dr = orig.max.x + radius - pos.x;
      const dn = pos.y - orig.min.z + radius;
      const df = orig.max.z + radius - pos.y;
      const m = Math.min(dl, dr, dn, df);
      if (m === dl) pos.x = orig.min.x - radius;
      else if (m === dr) pos.x = orig.max.x + radius;
      else if (m === dn) pos.y = orig.min.z - radius;
      else pos.y = orig.max.z + radius;
    }
  }
  pos.x = clamp(pos.x, -MAP_HALF + radius, MAP_HALF - radius);
  pos.y = clamp(pos.y, -MAP_HALF + radius, MAP_HALF - radius);
}

export function pointBlocked(x: number, z: number, pad: number, obstacles: Obstacle[]): boolean {
  for (const o of obstacles) {
    const b = o.box;
    if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) return true;
  }
  return false;
}

export function lineOfSight(x1: number, z1: number, x2: number, z2: number, obstacles: Obstacle[]): boolean {
  for (const o of obstacles) {
    const b = o.box;
    if (b.max.y < 1) continue;
    if (segmentAabbXZ(x1, z1, x2, z2, b.min.x, b.min.z, b.max.x, b.max.z)) return false;
  }
  return true;
}

function segmentAabbXZ(
  x1: number, z1: number, x2: number, z2: number,
  minx: number, minz: number, maxx: number, maxz: number,
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let tmin = 0;
  let tmax = 1;
  const sweep = (p: number, d: number, lo: number, hi: number) => {
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return false; return true; }
    let t1 = (lo - p) / d, t2 = (hi - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    return tmax >= tmin;
  };
  if (!sweep(x1, dx, minx, maxx)) return false;
  if (!sweep(z1, dz, minz, maxz)) return false;
  return tmax >= tmin && tmin <= 1 && tmax >= 0;
}
