import * as THREE from "three";

const HANGAR_RADIUS = 16;

export function buildHangarFloor(): { mesh: THREE.Mesh; concrete: THREE.MeshStandardMaterial; grid: THREE.GridHelper } {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x2d3138, roughness: 0.85, metalness: 0.15 });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(HANGAR_RADIUS + 4, 64), concrete);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  const grid = new THREE.GridHelper(HANGAR_RADIUS * 2, 28, 0x6f8a2e, 0x3a4432);
  grid.position.y = 0.012;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.55; });
  return { mesh, concrete, grid };
}
