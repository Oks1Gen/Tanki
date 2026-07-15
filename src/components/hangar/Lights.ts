import * as THREE from "three";

const HANGAR_RADIUS = 16;

export function buildHangarLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0x9fb4d4, 0x14171c, 0.55));
  scene.add(new THREE.AmbientLight(0x241f17, 0.16));

  const key = new THREE.SpotLight(0xfff4e0, 1600, 150, Math.PI / 6, 0.5, 2);
  key.position.set(8, 30, 6); key.target.position.set(0, 1.2, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04;
  scene.add(key, key.target);

  const rim = new THREE.SpotLight(0xffe2b0, 650, 140, Math.PI / 6, 0.5, 2);
  rim.position.set(-10, 24, -6); rim.target.position.set(0, 1.2, 0); scene.add(rim, rim.target);

  const addBeam = (pos: THREE.Vector3, rot: { x: number; z: number }, color: number, coreOp: number, haloOp: number) => {
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(18, 46, 40, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: coreOp, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.position.copy(pos); core.rotation.set(rot.x, 0, rot.z); scene.add(core);
    const halo = new THREE.Mesh(
      new THREE.ConeGeometry(30, 46, 40, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: haloOp, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.position.copy(pos); halo.rotation.set(rot.x, 0, rot.z); scene.add(halo);
  };
  addBeam(new THREE.Vector3(5, 24, 4), { x: 0.25, z: -0.35 }, 0xfff4e0, 0.025, 0.012);
  addBeam(new THREE.Vector3(-7, 20, -4), { x: -0.2, z: 0.35 }, 0xffe2b0, 0.018, 0.009);

  const warm = new THREE.PointLight(0xfff4e0, 90, 28, 2); warm.position.set(7, 1.6, -5); scene.add(warm);
  const warm2 = new THREE.PointLight(0xffe6c0, 60, 26, 2); warm2.position.set(-7, 1.4, 5); scene.add(warm2);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * (HANGAR_RADIUS - 3), z = Math.sin(angle) * (HANGAR_RADIUS - 3);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.6, metalness: 0.3 }));
    fixture.position.set(x, 12.2, z); scene.add(fixture);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.28), new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xfff4e0, emissiveIntensity: 1.4, roughness: 0.4 }));
    strip.position.set(x, 12.1, z); scene.add(strip);
  }

  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ color: 0x9fb07a, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  haze.rotation.x = -Math.PI / 2; haze.position.y = 0.4; scene.add(haze);
}
