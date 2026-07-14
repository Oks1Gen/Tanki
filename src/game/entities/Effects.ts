import * as THREE from "three";
import type { Effect, Spark } from "../GameTypes";

export function createEffectsManager(scene: THREE.Scene) {
  const effects: Effect[] = [];

  function spawnMuzzleFlash(origin: THREE.Vector3, dir: THREE.Vector3, flashGeo: THREE.SphereGeometry) {
    const group = new THREE.Group();
    const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.scale.setScalar(0.6);
    group.add(flash);
    const light = new THREE.PointLight(0xffb24d, 6, 18, 2);
    group.add(light);
    group.position.copy(origin);
    group.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    scene.add(group);

    const effect: Effect = {
      group, age: 0, life: 0.12, light, sparks: [], grow: [flash],
      update: (dt) => {
        effect.age += dt;
        const p = effect.age / effect.life;
        flash.scale.setScalar(0.6 + p * 1.6);
        (flash.material as THREE.MeshBasicMaterial).opacity = 1 - p;
        if (effect.light) effect.light.intensity = 6 * (1 - p);
        return p < 1;
      },
    };
    effects.push(effect);
  }

  function spawnImpact(point: THREE.Vector3, scale: number, flashGeo: THREE.SphereGeometry, sparkGeo: THREE.SphereGeometry) {
    const group = new THREE.Group();
    group.position.copy(point);

    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.scale.setScalar(0.5 * scale);
    group.add(flash);

    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const smoke = new THREE.Mesh(flashGeo, smokeMat);
    smoke.scale.setScalar(0.4 * scale);
    group.add(smoke);

    const light = new THREE.PointLight(0xff8a3a, 4 * scale, 22 * scale, 2);
    group.add(light);

    const sparks: Spark[] = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const n = Math.round(6 + scale * 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat);
      m.position.set(0, 0, 0);
      group.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4, (Math.random() - 0.5) * 2)
        .normalize().multiplyScalar((4 + Math.random() * 6) * scale);
      sparks.push({ mesh: m, vel: v });
    }

    scene.add(group);

    const effect: Effect = {
      group, age: 0, life: 0.5 + scale * 0.12, light, sparks, grow: [flash, smoke],
      update: (dt) => {
        effect.age += dt;
        const p = Math.min(effect.age / effect.life, 1);
        flash.scale.setScalar((0.5 + p * 1.8) * scale);
        (flash.material as THREE.MeshBasicMaterial).opacity = 1 - p;
        smoke.scale.setScalar((0.4 + p * 4) * scale);
        (smoke.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.6;
        if (effect.light) effect.light.intensity = 4 * scale * (1 - p);
        for (const sp of effect.sparks) {
          sp.vel.y -= 14 * dt;
          sp.mesh.position.addScaledVector(sp.vel, dt);
          (sp.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p;
        }
        return p < 1;
      },
    };
    effects.push(effect);
  }

  function updateEffects(dt: number) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      const alive = e.update(dt);
      if (!alive) {
        scene.remove(e.group);
        e.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat.dispose();
          }
        });
        effects.splice(i, 1);
      }
    }
  }

  return { spawnMuzzleFlash, spawnImpact, updateEffects };
}
