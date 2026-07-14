import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TankModel } from "../types";
import { TANK_SPECS, createTankMesh } from "../game/tanks";

const HANGAR_RADIUS = 16;

function buildHangarFloor(): { mesh: THREE.Mesh; concrete: THREE.MeshStandardMaterial; grid: THREE.GridHelper } {
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x2d3138,
    roughness: 0.85,
    metalness: 0.15,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(HANGAR_RADIUS + 4, 64), concrete);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  const grid = new THREE.GridHelper(HANGAR_RADIUS * 2, 28, 0x6f8a2e, 0x3a4432);
  grid.position.y = 0.012;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.55;
  });
  return { mesh, concrete, grid };
}

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildHangarWalls(scene: THREE.Scene) {
  // Concrete walls with a corrugated panel pattern baked into the texture.
  const wallTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#1b1f18";
    ctx.fillRect(0, 0, w, h);
    // Vertical panel seams.
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // Bolt rows.
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    for (let y = 32; y < h; y += 96) {
      for (let x = 16; x < w; x += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Grime streaks.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 40 + Math.random() * 90);
    }
  }, 1024, 512);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(8, 1);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0x2a3024,
    roughness: 0.92,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x54711f,
    roughness: 0.7,
    metalness: 0.3,
    emissive: 0x1c2a08,
    emissiveIntensity: 0.4,
  });

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HANGAR_RADIUS, HANGAR_RADIUS, 11, 48, 1, true), wallMat);
  wall.position.y = 5.5;
  wall.receiveShadow = true;
  scene.add(wall);

  // Hazard stripes.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(HANGAR_RADIUS + 0.01, HANGAR_RADIUS + 0.01, 0.5, 48, 1, true), trimMat);
  stripe.position.y = 1.0;
  scene.add(stripe);
  const stripeTop = stripe.clone();
  stripeTop.position.y = 9.6;
  scene.add(stripeTop);

  // Support pillars (steel I-beams).
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * (HANGAR_RADIUS - 0.1);
    const z = Math.sin(angle) * (HANGAR_RADIUS - 0.1);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x354030, roughness: 0.6, metalness: 0.7 });
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.18, 11, 0.7), beamMat);
    web.position.set(x, 5.5, z);
    web.lookAt(0, 5.5, 0);
    web.castShadow = true;
    scene.add(web);
    const flange1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 11, 0.9), beamMat);
    flange1.position.set(x, 5.5, z);
    flange1.lookAt(0, 5.5, 0);
    scene.add(flange1);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), trimMat);
    cap.position.set(x, 11, z);
    scene.add(cap);
  }

  // Roof cone.
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(HANGAR_RADIUS + 0.4, 4, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.9, side: THREE.DoubleSide }),
  );
  roof.position.y = 13;
  scene.add(roof);

  // Overhead crane bridge (steel truss spanning the hangar).
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xb6d94c, roughness: 0.55, metalness: 0.6, emissive: 0x2c3a0e, emissiveIntensity: 0.25 });
  const craneY = 10.2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HANGAR_RADIUS * 1.6, 0.55, 0.9), craneMat);
  beam.position.set(0, craneY, 0);
  beam.castShadow = true;
  scene.add(beam);
  // Truss diagonals on the beam.
  for (let i = -6; i <= 6; i++) {
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), craneMat);
    diag.position.set(i * 1.1, craneY, 0.46);
    diag.rotation.z = Math.PI / 4 * (i % 2 === 0 ? 1 : -1);
    scene.add(diag);
    const diag2 = diag.clone();
    diag2.position.z = -0.46;
    scene.add(diag2);
  }
  // Trolley + hook on the crane.
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), new THREE.MeshStandardMaterial({ color: 0x1c2416, roughness: 0.6, metalness: 0.6 }));
  trolley.position.set(2, craneY - 0.7, 0);
  scene.add(trolley);
  // Chains hanging from the trolley.
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x3a4432, roughness: 0.7, metalness: 0.8 });
  for (const cx of [-0.55, 0.55]) {
    const chainLen = 4.2;
    const links = 14;
    for (let k = 0; k < links; k++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 6, 10), chainMat);
      link.position.set(2 + cx, craneY - 0.7 - (k + 0.5) * (chainLen / links), 0);
      link.rotation.y = k % 2 === 0 ? 0 : Math.PI / 2;
      scene.add(link);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 18, Math.PI * 1.4), chainMat);
    hook.position.set(2 + cx, craneY - 0.7 - chainLen, 0);
    hook.rotation.x = Math.PI / 2;
    scene.add(hook);
  }

  // Tactical map poster on a wall segment.
  const posterTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#d7cfb3";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3a4432";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#3a4432";
    ctx.font = "bold 44px 'Arial Narrow', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SECTOR ALPHA-7", w / 2, 70);
    ctx.font = "bold 22px 'Arial Narrow', system-ui, sans-serif";
    ctx.fillText("FIELD OPERATIONS MAP", w / 2, 102);
    // Terrain contour lines.
    ctx.strokeStyle = "rgba(58,68,50,0.45)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + (Math.random() - 0.5) * 80, h / 2 + 40, 40 + i * 14, 30 + i * 10, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Red objective markers.
    ctx.fillStyle = "#b32020";
    for (let i = 0; i < 5; i++) {
      const mx = 80 + Math.random() * (w - 160);
      const my = 160 + Math.random() * (h - 220);
      ctx.beginPath();
      ctx.moveTo(mx, my - 14);
      ctx.lineTo(mx + 12, my + 8);
      ctx.lineTo(mx - 12, my + 8);
      ctx.closePath();
      ctx.fill();
    }
    // Green friendly marker.
    ctx.fillStyle = "#2d5a1a";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 40, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7cfb3";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 40, 5, 0, Math.PI * 2);
    ctx.fill();
  }, 768, 512);
  const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.85, metalness: 0.05 });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), posterMat);
  poster.position.set(0, 5.6, -(HANGAR_RADIUS - 0.15));
  scene.add(poster);
  const posterFrame = new THREE.Mesh(new THREE.BoxGeometry(5.3, 3.7, 0.12), new THREE.MeshStandardMaterial({ color: 0x354030, roughness: 0.6, metalness: 0.5 }));
  posterFrame.position.set(0, 5.6, -(HANGAR_RADIUS - 0.2));
  scene.add(posterFrame);

  // Workbench against the side wall with tools.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85 });
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 1.2), benchMat);
  benchTop.position.set(HANGAR_RADIUS - 1.2, 1.05, 6);
  benchTop.rotation.y = -Math.PI / 2;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  scene.add(benchTop);
  for (const leg of [[-2, -0.45], [2, -0.45], [-2, 0.45], [2, 0.45]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), benchMat);
    l.position.set(HANGAR_RADIUS - 1.2 + leg[1], 0.5, 6 + leg[0]);
    scene.add(l);
  }
  // Vise + tool rolls on the bench.
  const viseMat = new THREE.MeshStandardMaterial({ color: 0x555a4a, roughness: 0.6, metalness: 0.7 });
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), viseMat);
  vise.position.set(HANGAR_RADIUS - 1.05, 1.35, 6.6);
  scene.add(vise);
  const toolRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0x54711f, roughness: 0.8 }));
  toolRoll.rotation.z = Math.PI / 2;
  toolRoll.rotation.y = Math.PI / 2;
  toolRoll.position.set(HANGAR_RADIUS - 1.2, 1.2, 5.2);
  scene.add(toolRoll);
}

function buildHangarLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0x8fa6c2, 0x0a0c10, 0.7));

  // Key spot with visible cone.
  const key = new THREE.SpotLight(0xfff0d0, 90, 60, Math.PI / 5.5, 0.55, 1.2);
  key.position.set(8, 18, 6);
  key.target.position.set(0, 1.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.04;
  scene.add(key, key.target);

  // Visible light cone for the key spot (volumetric fake).
  const coneGeo = new THREE.ConeGeometry(7, 16, 32, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2cc,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(5, 10, 4);
  cone.rotation.z = -0.35;
  cone.rotation.x = 0.25;
  scene.add(cone);

  const rim = new THREE.SpotLight(0x6fa0d0, 45, 50, Math.PI / 4, 0.5, 1.4);
  rim.position.set(-10, 12, -6);
  rim.target.position.set(0, 1.5, 0);
  scene.add(rim, rim.target);

  const rimCone = new THREE.Mesh(coneGeo.clone(), coneMat.clone());
  (rimCone.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x6fa0d0);
  (rimCone.material as THREE.MeshBasicMaterial).opacity = 0.05;
  rimCone.position.set(-7, 8, -4);
  rimCone.rotation.z = 0.35;
  rimCone.rotation.x = -0.2;
  scene.add(rimCone);

  const warm = new THREE.PointLight(0xd7a53a, 18, 24, 1.6);
  warm.position.set(7, 1.6, -5);
  scene.add(warm);
  const blue = new THREE.PointLight(0x3b82f6, 12, 22, 1.7);
  blue.position.set(-7, 1.4, 5);
  scene.add(blue);

  // Ceiling work lights (4 long fluorescent fixtures with glowing strips).
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * (HANGAR_RADIUS - 3);
    const z = Math.sin(angle) * (HANGAR_RADIUS - 3);
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1f2227, roughness: 0.6, metalness: 0.3 }),
    );
    fixture.position.set(x, 12.2, z);
    scene.add(fixture);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.04, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xfff2cc, emissiveIntensity: 1.4, roughness: 0.4 }),
    );
    strip.position.set(x, 12.1, z);
    scene.add(strip);
  }

  // Floor dust / volumetric haze plane around the tank.
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({
      color: 0x9fb07a,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = 0.4;
  scene.add(haze);
}

function buildTools(scene: THREE.Scene) {
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x3a4432, roughness: 0.7, metalness: 0.35 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xb6d94c, roughness: 0.6, metalness: 0.4, emissive: 0x2c3a0e, emissiveIntensity: 0.2 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0x8a6a1e, roughness: 0.7 });

  // Ammo crates with stenciled labels — stacked near the tank.
  const crateTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#3a4432";
    ctx.fillRect(0, 0, w, h);
    // Wood grain / metal panel lines.
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    for (let x = 32; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // Stencil text.
    ctx.fillStyle = "#b6d94c";
    ctx.font = "bold 72px 'Arial Narrow', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("122mm HE", w / 2, h / 2 - 40);
    ctx.font = "bold 44px 'Arial Narrow', system-ui, sans-serif";
    ctx.fillText("QTY 24 · LOT 0447", w / 2, h / 2 + 30);
    // Corner brackets.
    ctx.strokeStyle = "#b6d94c";
    ctx.lineWidth = 6;
    const m = 20;
    const L = 50;
    ctx.beginPath();
    ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
    ctx.moveTo(w - m - L, m); ctx.lineTo(w - m, m); ctx.lineTo(w - m, m + L);
    ctx.moveTo(m, h - m - L); ctx.lineTo(m, h - m); ctx.lineTo(m + L, h - m);
    ctx.moveTo(w - m - L, h - m); ctx.lineTo(w - m, h - m); ctx.lineTo(w - m, h - m - L);
    ctx.stroke();
  }, 512, 256);
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, metalness: 0.2 });

  const crateStacks: [number, number, number][] = [
    [-6.5, 0, 4.5],
    [-6.5, 0.9, 4.5],
    [-5.5, 0, 4.8],
    [6.8, 0, -4.5],
    [6.8, 0.9, -4.5],
  ];
  for (const [x, y, z] of crateStacks) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.9), crateMat);
    crate.position.set(x, y + 0.45, z);
    crate.rotation.y = (Math.random() - 0.5) * 0.12;
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
  }

  // Oil drums (green, military).
  const drumPositions: [number, number, number][] = [
    [5.5, 0, 5],
    [5, 0, 5.7],
    [-5, 0, -5.5],
  ];
  for (const [x, y, z] of drumPositions) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 20), drumMat);
    drum.position.set(x, y + 0.75, z);
    drum.castShadow = true;
    drum.receiveShadow = true;
    scene.add(drum);
    for (const yy of [0.15, 1.35]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 20), bandMat);
      band.position.set(x, y + yy, z);
      scene.add(band);
    }
  }

  // Fire extinguisher mounted on a pillar.
  const extMat = new THREE.MeshStandardMaterial({ color: 0xb32020, roughness: 0.5, metalness: 0.3 });
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 16), extMat);
  ext.position.set(HANGAR_RADIUS - 0.4, 2.0, -2);
  scene.add(ext);
  const extCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.8, roughness: 0.3 }));
  extCap.position.set(HANGAR_RADIUS - 0.4, 2.4, -2);
  scene.add(extCap);

  // Yellow hazard wedge near the tank (wheel chock).
  const wedgeMat = new THREE.MeshStandardMaterial({ color: 0xd7a53a, roughness: 0.6 });
  for (const [x, z] of [[3.2, 2.6], [-3.2, -2.6]]) {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.9), wedgeMat);
    wedge.position.set(x, 0.18, z);
    wedge.rotation.y = Math.atan2(x, z);
    scene.add(wedge);
  }

  // Stacked sandbags (low poly, scattered).
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x8a7e55, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const r = 9 + (i % 3) * 0.4;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), sandMat);
    bag.position.set(Math.cos(a) * r, 0.15 + (i % 2) * 0.3, Math.sin(a) * r);
    bag.rotation.y = a + Math.PI / 2;
    bag.castShadow = true;
    bag.receiveShadow = true;
    scene.add(bag);
  }
  void hazardMat;
}

export default function TankPreview({ tankModel }: { tankModel: TankModel }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);
    scene.fog = new THREE.Fog(0x0a0d12, 28, 60);

    const spec = TANK_SPECS[tankModel];
    const aspect = () => Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight));
    const camera = new THREE.PerspectiveCamera(36, aspect(), 0.05, 80);
    const radius = spec.id === "e100" ? 13.5 : spec.id === "t34" ? 11.5 : 11;
    const start = { yaw: 0.55, pitch: 0.18, distance: radius };
    const target = new THREE.Vector3(0, 1.6, 0);
    let yaw = start.yaw;
    let pitch = start.pitch;
    let distance = start.distance;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    const { mesh: floor, grid } = buildHangarFloor();
    scene.add(floor);
    scene.add(grid);
    buildHangarWalls(scene);
    buildHangarLights(scene);
    buildTools(scene);

    // The hero — the selected tank
    const tankPivot = new THREE.Group();
    tankPivot.position.y = 0;
    tankPivot.add(createTankMesh(spec, "player").group);
    scene.add(tankPivot);

    // Number stamp on the floor under the tank
    const stampMat = new THREE.MeshStandardMaterial({
      color: 0xb6d94c,
      emissive: 0x2c3a0e,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      transparent: true,
      opacity: 0.65,
    });
    const stamp = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.85, 48), stampMat);
    stamp.rotation.x = -Math.PI / 2;
    stamp.position.y = 0.02;
    scene.add(stamp);
    const innerStamp = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.7, 48), stampMat);
    innerStamp.rotation.x = -Math.PI / 2;
    innerStamp.position.y = 0.02;
    scene.add(innerStamp);

    // Animated safety beacon
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff4500, emissiveIntensity: 1.2, roughness: 0.2 }),
    );
    beacon.position.set(0, 5.6, 0);
    scene.add(beacon);
    const beaconLight = new THREE.PointLight(0xff6a00, 8, 10, 2);
    beaconLight.position.copy(beacon.position);
    scene.add(beaconLight);

    // Pointer / camera interaction with inertia for a tactile feel.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let idleTime = 0;
    let velYaw = 0;
    let velPitch = 0;
    let velDistance = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      idleTime = 0;
      velYaw = 0;
      velPitch = 0;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      velYaw = -dx * 0.0065;
      velPitch = dy * 0.0045;
      yaw += velYaw;
      pitch = Math.max(0.02, Math.min(0.55, pitch + velPitch));
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      renderer.domElement.style.cursor = "grab";
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      velDistance += event.deltaY * 0.012;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let raf = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      raf = requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.1);
      idleTime += dt;

      // Apply inertia when the user is not dragging.
      if (!dragging) {
        const decay = Math.pow(0.001, dt);
        velYaw *= decay;
        velPitch *= decay;
        yaw += velYaw;
        pitch = Math.max(0.02, Math.min(0.55, pitch + velPitch));
        // Gentle auto-orbit when idle so the hangar feels alive.
        if (idleTime > 1.6 && Math.abs(velYaw) < 0.0008) yaw += dt * 0.08;
      }
      // Smooth zoom with momentum.
      velDistance *= Math.pow(0.001, dt);
      distance = Math.max(6, Math.min(20, distance + velDistance));

      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      camera.position.set(
        Math.sin(yaw) * cp * distance,
        target.y + sp * distance + 2.0,
        Math.cos(yaw) * cp * distance,
      );
      camera.lookAt(target);

      // Beating beacon light.
      const pulse = 0.7 + Math.sin(Date.now() * 0.008) * 0.4;
      beaconLight.intensity = 6 + pulse * 6;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [tankModel]);

  return <div ref={containerRef} className="h-full w-full" />;
}
