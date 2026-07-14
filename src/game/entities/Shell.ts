import * as THREE from "three";
import type { Shell, Tank } from "../GameTypes";
import type { AmmoType } from "../../types";

const COLORS: Record<AmmoType, number> = { ap: 0xfff2b0, heat: 0xff6a3a, he: 0xff4444 };

export function createShellManager(scene: THREE.Scene, shellGeo: THREE.SphereGeometry, _shellMat: THREE.MeshBasicMaterial, trailMat: THREE.MeshBasicMaterial) {
  const shells: Shell[] = [];
  const _prev = new THREE.Vector3();
  const _next = new THREE.Vector3();
  const _travel = new THREE.Vector3();
  const _line3 = new THREE.Line3();
  const _ray = new THREE.Ray();
  const _center = new THREE.Vector3();
  const _closest = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 0, 1);
  const _dir = new THREE.Vector3();

  function spawnShell(origin: THREE.Vector3, vel: THREE.Vector3, owner: Tank, damage: number, type: AmmoType) {
    const group = new THREE.Group();
    const color = COLORS[type];
    const mat = new THREE.MeshBasicMaterial({ color });
    const tip = new THREE.Mesh(shellGeo, mat);
    group.add(tip);
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.8), trailMat.clone());
    trail.position.z = -1;
    group.add(trail);
    group.position.copy(origin);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _dir.copy(vel).normalize());
    group.quaternion.copy(q);
    scene.add(group);
    shells.push({ group, vel, life: 3.2, owner, damage, type });
  }

  function updateShells(dt: number, allTanks: Tank[], obstacles: { box: THREE.Box3 }[], tankAimHeight: (t: Tank) => number, onHit: (target: Tank, damage: number, point: THREE.Vector3, attacker: Tank, type: AmmoType) => void, onHitGround: (point: THREE.Vector3, type: AmmoType) => void) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.life -= dt;
      _prev.copy(s.group.position);
      _next.copy(s.vel).multiplyScalar(dt).add(_prev);
      _line3.set(_prev, _next);
      _travel.copy(_next).sub(_prev);
      const travelLength = _travel.length();
      _ray.set(_prev, travelLength > 0 ? _dir.copy(_travel).normalize() : _up);

      let hitPoint: THREE.Vector3 | null = null;
      let hitTarget: Tank | null = null;
      let nearestHit = Number.POSITIVE_INFINITY;

      const considerHit = (point: THREE.Vector3, target: Tank | null = null) => {
        const distance = _prev.distanceTo(point);
        if (distance <= travelLength + 0.001 && distance < nearestHit) {
          nearestHit = distance; hitPoint = point.clone(); hitTarget = target;
        }
      };

      if (_prev.y > 0.3 && _next.y <= 0.3) {
        const alpha = (_prev.y - 0.3) / Math.max(0.0001, _prev.y - _next.y);
        considerHit(_closest.copy(_prev).lerp(_next, alpha).setY(0.3));
      } else if (_next.y <= 0.3) {
        considerHit(_closest.copy(_next).setY(0.3));
      }

      for (const o of obstacles) {
        const point = _ray.intersectBox(o.box, _closest);
        if (point) considerHit(point);
      }

      for (const target of allTanks) {
        if (target === s.owner || target.dead) continue;
        _center.set(target.mesh.group.position.x, tankAimHeight(target), target.mesh.group.position.z);
        _closest.copy(_center);
        _line3.closestPointToPoint(_center, true, _closest);
        if (_closest.distanceTo(_center) <= target.radius + 0.45) {
          considerHit(_closest, target);
        }
      }

      s.group.position.copy(hitPoint ?? _next);
      const consumed = hitPoint !== null;
      if (hitPoint) {
        if (hitTarget) onHit(hitTarget, s.damage, hitPoint, s.owner, s.type);
        else onHitGround(hitPoint, s.type);
      }

      if (consumed || s.life <= 0) {
        scene.remove(s.group);
        s.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((x) => x.dispose());
          }
        });
        shells.splice(i, 1);
      }
    }
  }

  return { spawnShell, updateShells };
}
