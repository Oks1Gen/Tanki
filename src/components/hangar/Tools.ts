import * as THREE from "three";
import { makeCanvasTexture } from "./Textures";

const HANGAR_RADIUS = 16;

export function buildTools(scene: THREE.Scene) {
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x3a4432, roughness: 0.7, metalness: 0.35 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xb6d94c, roughness: 0.6, metalness: 0.4, emissive: 0x2c3a0e, emissiveIntensity: 0.2 });

  const crateTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#3a4432"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
    for (let x = 32; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = "#b6d94c"; ctx.font = "bold 72px 'Arial Narrow', system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("122mm HE", w / 2, h / 2 - 40);
    ctx.font = "bold 44px 'Arial Narrow', system-ui, sans-serif"; ctx.fillText("QTY 24 · LOT 0447", w / 2, h / 2 + 30);
    ctx.strokeStyle = "#b6d94c"; ctx.lineWidth = 6; const m = 20, L = 50;
    ctx.beginPath(); ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
    ctx.moveTo(w - m - L, m); ctx.lineTo(w - m, m); ctx.lineTo(w - m, m + L);
    ctx.moveTo(m, h - m - L); ctx.lineTo(m, h - m); ctx.lineTo(m + L, h - m);
    ctx.moveTo(w - m - L, h - m); ctx.lineTo(w - m, h - m); ctx.lineTo(w - m, h - m - L);
    ctx.stroke();
  }, 512, 256);
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, metalness: 0.2 });

  const crateStacks: [number, number, number][] = [[-6.5, 0, 4.5], [-6.5, 0.9, 4.5], [-5.5, 0, 4.8], [6.8, 0, -4.5], [6.8, 0.9, -4.5]];
  for (const [x, y, z] of crateStacks) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.9), crateMat);
    crate.position.set(x, y + 0.45, z); crate.rotation.y = (Math.random() - 0.5) * 0.12;
    crate.castShadow = true; crate.receiveShadow = true; scene.add(crate);
  }

  const drumPositions: [number, number, number][] = [[5.5, 0, 5], [5, 0, 5.7], [-5, 0, -5.5]];
  for (const [x, y, z] of drumPositions) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 20), drumMat);
    drum.position.set(x, y + 0.75, z); drum.castShadow = true; drum.receiveShadow = true; scene.add(drum);
    for (const yy of [0.15, 1.35]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 20), bandMat);
      band.position.set(x, y + yy, z); scene.add(band);
    }
  }

  const extMat = new THREE.MeshStandardMaterial({ color: 0xb32020, roughness: 0.5, metalness: 0.3 });
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 16), extMat);
  ext.position.set(HANGAR_RADIUS - 0.4, 2.0, -2); scene.add(ext);
  const extCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.8, roughness: 0.3 }));
  extCap.position.set(HANGAR_RADIUS - 0.4, 2.4, -2); scene.add(extCap);

  const wedgeMat = new THREE.MeshStandardMaterial({ color: 0xd7a53a, roughness: 0.6 });
  for (const [x, z] of [[3.2, 2.6], [-3.2, -2.6]]) {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.9), wedgeMat);
    wedge.position.set(x, 0.18, z); wedge.rotation.y = Math.atan2(x, z); scene.add(wedge);
  }

  const sandMat = new THREE.MeshStandardMaterial({ color: 0x8a7e55, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, r = 9 + (i % 3) * 0.4;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), sandMat);
    bag.position.set(Math.cos(a) * r, 0.15 + (i % 2) * 0.3, Math.sin(a) * r);
    bag.rotation.y = a + Math.PI / 2; bag.castShadow = true; bag.receiveShadow = true; scene.add(bag);
  }
}
