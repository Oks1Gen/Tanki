import * as THREE from "three";

const HANGAR_RADIUS = 16;

export function buildHangarLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0x8fa6c2, 0x0a0c10, 0.7));

  const key = new THREE.SpotLight(0xfff0d0, 90, 60, Math.PI / 5.5, 0.55, 1.2);
  key.position.set(8, 18, 6); key.target.position.set(0, 1.5, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04;
  scene.add(key, key.target);

  const coneGeo = new THREE.ConeGeometry(7, 16, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.06, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(5, 10, 4); cone.rotation.z = -0.35; cone.rotation.x = 0.25; scene.add(cone);

  const rim = new THREE.SpotLight(0x6fa0d0, 45, 50, Math.PI / 4, 0.5, 1.4);
  rim.position.set(-10, 12, -6); rim.target.position.set(0, 1.5, 0); scene.add(rim, rim.target);
  const rimCone = new THREE.Mesh(coneGeo.clone(), coneMat.clone());
  (rimCone.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x6fa0d0);
  (rimCone.material as THREE.MeshBasicMaterial).opacity = 0.05;
  rimCone.position.set(-7, 8, -4); rimCone.rotation.z = 0.35; rimCone.rotation.x = -0.2; scene.add(rimCone);

  const warm = new THREE.PointLight(0xd7a53a, 18, 24, 1.6); warm.position.set(7, 1.6, -5); scene.add(warm);
  const blue = new THREE.PointLight(0x3b82f6, 12, 22, 1.7); blue.position.set(-7, 1.4, 5); scene.add(blue);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * (HANGAR_RADIUS - 3), z = Math.sin(angle) * (HANGAR_RADIUS - 3);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.6, metalness: 0.3 }));
    fixture.position.set(x, 12.2, z); scene.add(fixture);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.28), new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xfff2cc, emissiveIntensity: 1.4, roughness: 0.4 }));
    strip.position.set(x, 12.1, z); scene.add(strip);
  }

  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ color: 0x9fb07a, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  haze.rotation.x = -Math.PI / 2; haze.position.y = 0.4; scene.add(haze);
}
