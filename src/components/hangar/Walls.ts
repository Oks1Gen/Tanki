import * as THREE from "three";
import { makeCanvasTexture } from "./Textures";

const HANGAR_RADIUS = 16;

export function buildHangarWalls(scene: THREE.Scene) {
  const wallTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#1b1f18"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    for (let y = 32; y < h; y += 96) { for (let x = 16; x < w; x += 64) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); } }
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 60; i++) { ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 40 + Math.random() * 90); }
  }, 1024, 512);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(8, 1);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x2a3024, roughness: 0.92, metalness: 0.2, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x54711f, roughness: 0.7, metalness: 0.3, emissive: 0x1c2a08, emissiveIntensity: 0.4 });

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HANGAR_RADIUS, HANGAR_RADIUS, 11, 48, 1, true), wallMat);
  wall.position.y = 5.5; wall.receiveShadow = true; scene.add(wall);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(HANGAR_RADIUS + 0.01, HANGAR_RADIUS + 0.01, 0.5, 48, 1, true), trimMat);
  stripe.position.y = 1.0; scene.add(stripe);
  const stripeTop = stripe.clone(); stripeTop.position.y = 9.6; scene.add(stripeTop);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * (HANGAR_RADIUS - 0.1);
    const z = Math.sin(angle) * (HANGAR_RADIUS - 0.1);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x354030, roughness: 0.6, metalness: 0.7 });
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.18, 11, 0.7), beamMat);
    web.position.set(x, 5.5, z); web.lookAt(0, 5.5, 0); web.castShadow = true; scene.add(web);
    const flange1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 11, 0.9), beamMat);
    flange1.position.set(x, 5.5, z); flange1.lookAt(0, 5.5, 0); scene.add(flange1);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), trimMat);
    cap.position.set(x, 11, z); scene.add(cap);
  }

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(HANGAR_RADIUS + 0.4, 4, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.9, side: THREE.DoubleSide }),
  );
  roof.position.y = 13; scene.add(roof);

  const craneMat = new THREE.MeshStandardMaterial({ color: 0xb6d94c, roughness: 0.55, metalness: 0.6, emissive: 0x2c3a0e, emissiveIntensity: 0.25 });
  const craneY = 10.2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HANGAR_RADIUS * 1.6, 0.55, 0.9), craneMat);
  beam.position.set(0, craneY, 0); beam.castShadow = true; scene.add(beam);
  for (let i = -6; i <= 6; i++) {
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), craneMat);
    diag.position.set(i * 1.1, craneY, 0.46); diag.rotation.z = Math.PI / 4 * (i % 2 === 0 ? 1 : -1); scene.add(diag);
    const diag2 = diag.clone(); diag2.position.z = -0.46; scene.add(diag2);
  }
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), new THREE.MeshStandardMaterial({ color: 0x1c2416, roughness: 0.6, metalness: 0.6 }));
  trolley.position.set(2, craneY - 0.7, 0); scene.add(trolley);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x3a4432, roughness: 0.7, metalness: 0.8 });
  for (const cx of [-0.55, 0.55]) {
    const chainLen = 4.2;
    for (let k = 0; k < 14; k++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 6, 10), chainMat);
      link.position.set(2 + cx, craneY - 0.7 - (k + 0.5) * (chainLen / 14), 0);
      link.rotation.y = k % 2 === 0 ? 0 : Math.PI / 2; scene.add(link);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 18, Math.PI * 1.4), chainMat);
    hook.position.set(2 + cx, craneY - 0.7 - chainLen, 0); hook.rotation.x = Math.PI / 2; scene.add(hook);
  }

  const posterTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#d7cfb3"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3a4432"; ctx.lineWidth = 3; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#3a4432";
    ctx.font = "bold 44px 'Arial Narrow', system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("SECTOR ALPHA-7", w / 2, 70);
    ctx.font = "bold 22px 'Arial Narrow', system-ui, sans-serif"; ctx.fillText("FIELD OPERATIONS MAP", w / 2, 102);
    ctx.strokeStyle = "rgba(58,68,50,0.45)"; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(w / 2 + (Math.random() - 0.5) * 80, h / 2 + 40, 40 + i * 14, 30 + i * 10, Math.random() * Math.PI, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#b32020";
    for (let i = 0; i < 5; i++) { const mx = 80 + Math.random() * (w - 160), my = 160 + Math.random() * (h - 220); ctx.beginPath(); ctx.moveTo(mx, my - 14); ctx.lineTo(mx + 12, my + 8); ctx.lineTo(mx - 12, my + 8); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#2d5a1a"; ctx.beginPath(); ctx.arc(w / 2, h / 2 + 40, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d7cfb3"; ctx.beginPath(); ctx.arc(w / 2, h / 2 + 40, 5, 0, Math.PI * 2); ctx.fill();
  }, 768, 512);
  const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.85, metalness: 0.05 });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), posterMat);
  poster.position.set(0, 5.6, -(HANGAR_RADIUS - 0.15)); scene.add(poster);
  const posterFrame = new THREE.Mesh(new THREE.BoxGeometry(5.3, 3.7, 0.12), new THREE.MeshStandardMaterial({ color: 0x354030, roughness: 0.6, metalness: 0.5 }));
  posterFrame.position.set(0, 5.6, -(HANGAR_RADIUS - 0.2)); scene.add(posterFrame);

  const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85 });
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 1.2), benchMat);
  benchTop.position.set(HANGAR_RADIUS - 1.2, 1.05, 6); benchTop.rotation.y = -Math.PI / 2; benchTop.castShadow = true; benchTop.receiveShadow = true;
  scene.add(benchTop);
  for (const leg of [[-2, -0.45], [2, -0.45], [-2, 0.45], [2, 0.45]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), benchMat);
    l.position.set(HANGAR_RADIUS - 1.2 + leg[1], 0.5, 6 + leg[0]); scene.add(l);
  }
  const viseMat = new THREE.MeshStandardMaterial({ color: 0x555a4a, roughness: 0.6, metalness: 0.7 });
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), viseMat);
  vise.position.set(HANGAR_RADIUS - 1.05, 1.35, 6.6); scene.add(vise);
  const toolRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0x54711f, roughness: 0.8 }));
  toolRoll.rotation.z = Math.PI / 2; toolRoll.rotation.y = Math.PI / 2;
  toolRoll.position.set(HANGAR_RADIUS - 1.2, 1.2, 5.2); scene.add(toolRoll);
}
