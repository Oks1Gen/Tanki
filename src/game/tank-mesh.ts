import * as THREE from "three";
import type { TankSpec } from "./tanks";
import type { CamoType } from "../types";
import { CAMO_COLORS } from "../data/upgrades";
import { addBox, addCylinder } from "../utils/three-helpers";

export interface TankMesh {
  group: THREE.Group;
  turret: THREE.Group;
  barrel: THREE.Object3D;
  muzzle: THREE.Object3D;
  recoilBase: number;
}

const BODY_COLOR_PLAYER = 0x278fe8;
const BODY_COLOR_BOT = 0xc83232;
const TRACK_COLOR = 0x17191d;
const METAL_COLOR = 0x343941;
const DETAIL_COLOR = 0x0b0d10;

function bodyColorFor(kind: "player" | "bot"): number {
  return kind === "player" ? BODY_COLOR_PLAYER : BODY_COLOR_BOT;
}

function makeStandard(color: number, rough = 0.6, metal = 0.4): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.65 });
}

function armorGeometry(bottomWidth: number, topWidth: number, height: number, length: number, frontSlope: number) {
  const bw = bottomWidth / 2;
  const tw = topWidth / 2;
  const h = height / 2;
  const l = length / 2;
  const fz = l - frontSlope;
  const positions = new Float32Array([
    -bw, -h, -l, bw, -h, -l, bw, -h, l, -bw, -h, l,
    -tw, h, -l, tw, h, -l, tw, h, fz, -tw, h, fz,
  ]);
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 6, 5, 4, 7, 6,
    3, 2, 6, 3, 6, 7,
    0, 4, 5, 0, 5, 1,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function generateCamoTexture(camoType: CamoType): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const baseColor = CAMO_COLORS[camoType] || 0x278fe8;
  const r = (baseColor >> 16) & 0xff, g = (baseColor >> 8) & 0xff, b = baseColor & 0xff;

  let palette: [number, number, number][];
  switch (camoType) {
    case "forest":
      palette = [[r, g, b], [Math.round(r * 0.6), Math.round(g * 0.82), Math.round(b * 0.55)], [Math.round(r * 0.78), Math.round(g * 0.7), Math.round(b * 0.45)]];
      break;
    case "desert":
      palette = [[r, g, b], [Math.round(r * 0.82), Math.round(g * 0.76), Math.round(b * 0.58)], [Math.round(r * 0.7), Math.round(g * 0.58), Math.round(b * 0.42)]];
      break;
    case "winter":
      palette = [[r, g, b], [Math.min(255, r - 25), Math.min(255, g - 25), Math.min(255, b - 25)], [Math.round(r * 0.82), Math.round(g * 0.82), Math.round(b * 0.82)]];
      break;
    default:
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, size, size);
      const tex0 = new THREE.CanvasTexture(canvas);
      tex0.wrapS = tex0.wrapT = THREE.RepeatWrapping;
      tex0.repeat.set(2, 2);
      return tex0;
  }

  ctx.fillStyle = `rgb(${palette[0][0]},${palette[0][1]},${palette[0][2]})`;
  ctx.fillRect(0, 0, size, size);

  for (let pi = 1; pi < palette.length; pi++) {
    const [pr, pg, pb] = palette[pi];
    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    for (let i = 0; i < 14; i++) {
      const cx = Math.random() * size, cy = Math.random() * size;
      const pts = 8 + Math.floor(Math.random() * 8);
      const baseR = 35 + Math.random() * 75;
      ctx.beginPath();
      for (let j = 0; j <= pts; j++) {
        const a = (j / pts) * Math.PI * 2, v = 0.55 + Math.random() * 0.45;
        const px = cx + baseR * v * Math.cos(a), py = cy + baseR * v * Math.sin(a);
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  return tex;
}

export function createTankMesh(spec: TankSpec, kind: "player" | "bot", bodyColorOverride?: number, camoType?: CamoType, headlights = true): TankMesh {
  const group = new THREE.Group();
  const bodyColor = bodyColorOverride ?? bodyColorFor(kind);
  const darkMult = 0.55;
  const edgeMult = 0.38;
  const r = (bodyColor >> 16) & 0xff, g = (bodyColor >> 8) & 0xff, b = bodyColor & 0xff;
  const bodyDark = (Math.round(r * darkMult) << 16) | (Math.round(g * darkMult) << 8) | Math.round(b * darkMult);
  const edgeDark = (Math.round(r * edgeMult) << 16) | (Math.round(g * edgeMult) << 8) | Math.round(b * edgeMult);
  const matBody = makeStandard(bodyColor, 0.48, 0.38);
  const matBodyDark = makeStandard(bodyDark, 0.58, 0.4);
  const matEdge = makeStandard(edgeDark, 0.68, 0.35);
  if (camoType) {
    const tex = generateCamoTexture(camoType);
    matBody.map = tex;
    matBody.needsUpdate = true;
    matBodyDark.map = tex;
    matBodyDark.needsUpdate = true;
  }
  const matTrack = makeStandard(TRACK_COLOR, 0.86, 0.55);
  const matRubber = makeStandard(0x111317, 0.95, 0.05);
  const matMetal = makeStandard(METAL_COLOR, 0.36, 0.78);
  const matDetail = makeStandard(DETAIL_COLOR, 0.52, 0.65);
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x09151c, roughness: 0.08, metalness: 0.75, emissive: 0x0d3348, emissiveIntensity: 0.55 });
  const matLight = new THREE.MeshStandardMaterial({ color: 0xffedbf, emissive: 0xffc75a, emissiveIntensity: 1.4, roughness: 0.2 });

  const trackX = spec.hull.width / 2 - spec.track.width / 2;
  const wheelR = spec.track.height * 0.43;
  const wheelCount = spec.id === "e100" ? 8 : spec.id === "t34" ? 5 : 6;
  const wheelSpan = spec.hull.length - wheelR * 2.6;
  const treadCount = Math.round(spec.hull.length / 0.34);
  const treadInstances = new THREE.InstancedMesh(
    new THREE.BoxGeometry(spec.track.width * 1.08, 0.09, spec.hull.length / treadCount * 0.78),
    matTrack, treadCount * 4,
  );
  const wheelInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR, wheelR, spec.track.width * 0.76, 20),
    matRubber, wheelCount * 2,
  );
  const hubInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR * 0.68, wheelR * 0.68, spec.track.width * 0.8, 18),
    matBodyDark, wheelCount * 2,
  );
  const boltInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR * 0.18, wheelR * 0.18, spec.track.width * 0.84, 14),
    matMetal, wheelCount * 2,
  );
  const dummy = new THREE.Object3D();
  let treadIndex = 0;
  let wheelIndex = 0;

  const hullFrontZ = spec.hull.length / 2;
  const hullRearZ = -spec.hull.length / 2;
  const sprocketY = wheelR + 0.1;
  const returnRollerY = spec.track.height + 0.02;

  for (const side of [-1, 1]) {
    addBox(group, [spec.track.width, spec.track.height * 0.28, spec.hull.length], [side * trackX, spec.track.height * 0.15, 0], matTrack);
    addBox(group, [spec.track.width, spec.track.height * 0.24, spec.hull.length * 0.96], [side * trackX, spec.track.height * 0.86, 0], matTrack);

    for (let i = 0; i < treadCount; i++) {
      const z = hullRearZ + (i + 0.5) * (spec.hull.length / treadCount);
      dummy.position.set(side * trackX, spec.track.height + 0.015, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      treadInstances.setMatrixAt(treadIndex++, dummy.matrix);
      dummy.position.y = 0.015;
      dummy.updateMatrix();
      treadInstances.setMatrixAt(treadIndex++, dummy.matrix);
    }

    for (let i = 0; i < wheelCount; i++) {
      const z = -wheelSpan / 2 + i * (wheelSpan / Math.max(1, wheelCount - 1));
      dummy.position.set(side * trackX, wheelR + 0.08, z);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.updateMatrix();
      wheelInstances.setMatrixAt(wheelIndex, dummy.matrix);
      hubInstances.setMatrixAt(wheelIndex, dummy.matrix);
      boltInstances.setMatrixAt(wheelIndex, dummy.matrix);
      wheelIndex++;
    }

    addCylinder(group, wheelR * 1.15, spec.track.width * 0.7, [side * trackX, sprocketY, hullRearZ + wheelR * 0.6], matMetal, [0, 0, Math.PI / 2], 14);
    addCylinder(group, wheelR * 0.95, spec.track.width * 0.72, [side * trackX, sprocketY, hullFrontZ - wheelR * 0.6], matMetal, [0, 0, Math.PI / 2], 14);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const r = wheelR * 1.15;
      addBox(group, [0.08, 0.18, spec.track.width * 0.55], [side * trackX, sprocketY + Math.sin(ang) * r, hullRearZ + wheelR * 0.6 + Math.cos(ang) * r], matMetal, [ang, 0, 0]);
    }

    for (const uz of [-spec.hull.length * 0.22, spec.hull.length * 0.22]) {
      addCylinder(group, wheelR * 0.42, spec.track.width * 0.55, [side * trackX, returnRollerY, uz], matMetal, [0, 0, Math.PI / 2], 12);
    }

    addBox(group, [spec.track.width * 1.12, 0.08, spec.hull.length * 1.02], [side * trackX, spec.track.height + 0.17, -0.03], matBodyDark);
    addBox(group, [0.08, spec.track.height * 0.62, spec.hull.length * 0.82], [side * (spec.hull.width / 2 + 0.04), spec.track.height * 0.65, -0.1], matBodyDark);

    if (spec.id === "e100") {
      addBox(group, [0.12, spec.track.height * 0.95, spec.hull.length * 0.92], [side * (spec.hull.width / 2 + 0.08), spec.track.height * 0.55, 0], matEdge);
      for (const zz of [-spec.hull.length * 0.3, 0, spec.hull.length * 0.3]) {
        addBox(group, [0.16, spec.track.height * 0.95, 0.1], [side * (spec.hull.width / 2 + 0.1), spec.track.height * 0.55, zz], matEdge);
      }
    }
  }
  for (const instances of [treadInstances, wheelInstances, hubInstances, boltInstances]) {
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = true;
    instances.receiveShadow = true;
    group.add(instances);
  }

  const lowerH = spec.hull.height;
  const lowerW = spec.hull.width - spec.track.width * 1.35;
  const lower = new THREE.Mesh(armorGeometry(lowerW, lowerW * 0.88, lowerH, spec.hull.length * 0.94, lowerH * 0.58), matBodyDark);
  lower.position.y = spec.track.height + lowerH / 2 - 0.02;
  group.add(lower);

  const upperH = spec.hull.height * 0.66;
  const upperW = spec.hull.width * (spec.id === "e100" ? 0.82 : 0.76);
  const upper = new THREE.Mesh(armorGeometry(upperW, upperW * 0.84, upperH, spec.hull.length * 0.72, upperH * 0.72), matBody);
  const upperY = spec.track.height + lowerH + upperH / 2 - 0.08;
  upper.position.set(0, upperY, 0.08);
  group.add(upper);

  const deckY = upperY + upperH / 2 + 0.035;
  addBox(group, [upperW * 0.8, 0.08, spec.hull.length * 0.3], [0, deckY, -spec.hull.length * 0.2], matEdge);
  for (let i = -2; i <= 2; i++) {
    addBox(group, [upperW * 0.11, 0.035, spec.hull.length * 0.22], [i * upperW * 0.145, deckY + 0.055, -spec.hull.length * 0.23], matDetail);
  }

  const upperFrontZ = 0.08 + spec.hull.length * 0.34;
  const upperRearZ = 0.08 - spec.hull.length * 0.36;
  const fenderTopY = spec.track.height + 0.21;

  for (const side of [-1, 1]) {
    const lightX = side * upperW * 0.34;
    const lightY = upperY - upperH * 0.05;
    addCylinder(group, 0.16, 0.12, [lightX, lightY, upperFrontZ - 0.02], matDetail, [Math.PI / 2, 0, 0], 14);
    addCylinder(group, 0.12, 0.14, [lightX, lightY, upperFrontZ + 0.05], matLight, [Math.PI / 2, 0, 0], 14);
    if (headlights) {
      const lamp = new THREE.SpotLight(0xfff4e0, 120, 48, Math.PI / 6, 0.5, 2);
      lamp.position.set(lightX, lightY, upperFrontZ + 0.08);
      const lampTarget = new THREE.Object3D();
      lampTarget.position.set(lightX, lightY - 1.4, upperFrontZ + 24);
      group.add(lamp, lampTarget);
      lamp.target = lampTarget;
    }
    addCylinder(group, spec.id === "e100" ? 0.2 : 0.14, spec.hull.length * 0.34, [side * (spec.hull.width / 2 - spec.track.width * 0.15), fenderTopY + 0.05, upperRearZ + spec.hull.length * 0.06], matMetal, [Math.PI / 2, 0, 0], 14);
  }

  addBox(group, [upperW * 0.5, 0.28, spec.hull.length * 0.16], [0, deckY + 0.16, upperRearZ + spec.hull.length * 0.08], matDetail);
  addBox(group, [0.12, 0.18, 0.42], [-upperW * 0.3, deckY + 0.1, spec.hull.length * 0.34], matEdge, [0, 0.35, 0]);
  addBox(group, [0.12, 0.18, 0.42], [upperW * 0.3, deckY + 0.1, spec.hull.length * 0.34], matEdge, [0, -0.35, 0]);

  if (spec.id === "t34") {
    for (const side of [-1, 1]) {
      for (const z of [-1.65, -0.45]) {
        const drumY = fenderTopY + 0.24;
        addCylinder(group, 0.24, 1.0, [side * (spec.hull.width / 2 + 0.18), drumY, z], matBodyDark, [Math.PI / 2, 0, 0], 16);
        addCylinder(group, 0.25, 0.06, [side * (spec.hull.width / 2 + 0.18), drumY, z + 0.5], matEdge, [Math.PI / 2, 0, 0], 16);
        addCylinder(group, 0.25, 0.06, [side * (spec.hull.width / 2 + 0.18), drumY, z - 0.5], matEdge, [Math.PI / 2, 0, 0], 16);
        for (const dz of [-0.32, 0.32]) {
          addCylinder(group, 0.27, 0.05, [side * (spec.hull.width / 2 + 0.18), drumY, z + dz], matMetal, [Math.PI / 2, 0, 0], 16);
        }
        addBox(group, [0.2, 0.18, 0.9], [side * (spec.hull.width / 2 + 0.04), drumY - 0.05, z], matEdge);
      }
    }
  }

  for (const side of [-1, 1]) {
    addBox(group, [0.1, 0.2, 0.18], [side * upperW * 0.3, upperY - upperH * 0.2, upperRearZ - 0.08], matMetal);
    addCylinder(group, 0.07, 0.12, [side * upperW * 0.3, upperY - upperH * 0.35, upperRearZ - 0.14], matMetal, [Math.PI / 2, 0, 0], 10);
  }

  if (spec.id === "t34") {
    addCylinder(group, 0.05, 1.2, [upperW * 0.2, deckY + 0.08, upperRearZ + 0.4], matMetal, [Math.PI / 2, 0, 0], 8);
    addBox(group, [0.24, 0.04, 0.3], [upperW * 0.2, deckY + 0.06, upperRearZ - 0.18], matDetail);
  }

  const turret = new THREE.Group();
  turret.position.set(0, deckY + 0.08, -spec.hull.length * 0.03);
  group.add(turret);
  const t = spec.turret;

  addCylinder(turret, t.radius * 0.84, 0.16, [0, 0.02, 0], matEdge, [0, 0, 0], 32);
  addCylinder(turret, t.radius * 0.78, 0.04, [0, 0.12, 0], matDetail, [0, 0, 0], 32);

  let roofTopY: number;
  if (t.type === "box") {
    const turretBody = new THREE.Mesh(armorGeometry(t.width, t.width * 0.84, t.height, t.length, 0.38), matBody);
    turretBody.position.y = t.height / 2;
    turret.add(turretBody);
    addBox(turret, [t.width * 0.9, t.height * 0.7, 0.34], [0, t.height * 0.52, t.length / 2 - 0.06], matBodyDark);
    for (const side of [-1, 1]) {
      addBox(turret, [0.26, 0.42, 0.78], [side * (t.width / 2 - 0.02), t.height * 0.5, 0.2], matEdge);
    }
    roofTopY = t.height;
  } else if (t.type === "round") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(t.radius * 0.9, t.radius, t.height * 0.5, 32), matBody);
    base.position.y = t.height * 0.25;
    turret.add(base);
    const domeR = t.radius * 0.9;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 32, 18), matBody);
    dome.scale.set(1, 0.52, 1.04);
    dome.position.y = t.height * 0.45;
    turret.add(dome);
    roofTopY = t.height * 0.45 + domeR * 0.52 - 0.03;
  } else {
    const body = new THREE.Mesh(armorGeometry(t.width, t.width * 0.82, t.height, t.length, 0.35), matBody);
    body.position.y = t.height / 2;
    turret.add(body);
    addBox(turret, [t.width * 0.78, t.height * 0.48, 0.28], [0, t.height * 0.45, t.length / 2], matBodyDark);
    roofTopY = t.height;
  }

  const cupolaH = t.height * 0.32;
  addCylinder(turret, t.radius * 0.24, cupolaH, [-t.radius * 0.32, roofTopY + cupolaH / 2 - 0.02, -t.radius * 0.34], matBodyDark, [0, 0, 0], 20);
  addCylinder(turret, t.radius * 0.21, 0.06, [-t.radius * 0.32, roofTopY + cupolaH, -t.radius * 0.34], matDetail, [0, 0, 0], 20);
  addBox(turret, [0.26, 0.2, 0.34], [t.radius * 0.3, roofTopY + 0.09, -t.radius * 0.08], matGlass);
  addCylinder(turret, t.radius * 0.16, 0.08, [t.radius * 0.05, roofTopY + 0.03, -t.radius * 0.02], matDetail, [0, 0, 0], 18);

  const antennaX = -t.radius * 0.42;
  const antennaZ = -t.radius * 0.48;
  addCylinder(turret, 0.07, 0.14, [antennaX, roofTopY + 0.06, antennaZ], matDetail, [0, 0, 0], 10);
  const antenna = addCylinder(turret, 0.022, 1.7, [antennaX, roofTopY + 0.12 + 0.85, antennaZ], matDetail, [0, 0, 0], 6);
  antenna.rotation.x = spec.id === "t100lt" ? 0.08 : 0.04;

  const barrelLen = spec.barrel.length;
  const barrelRadius = spec.barrel.radius;
  const frontZ = (t.type === "round" ? t.radius : t.length / 2) + 0.02;
  const barrelY = t.height * (t.type === "round" ? 0.55 : 0.5);
  const mantlet = addCylinder(turret, barrelRadius * 2.05, Math.max(0.34, t.height * 0.48), [0, barrelY, frontZ], matBodyDark, [Math.PI / 2, 0, 0], 20);
  mantlet.scale.x = 1.22;

  const barrel = new THREE.Group();
  barrel.position.set(0, barrelY, 0);
  turret.add(barrel);
  addCylinder(barrel, barrelRadius, barrelLen, [0, 0, frontZ + barrelLen / 2], matMetal, [Math.PI / 2, 0, 0], 20);
  addCylinder(barrel, barrelRadius * 1.3, barrelLen * 0.18, [0, 0, frontZ + barrelLen * 0.17], matDetail, [Math.PI / 2, 0, 0], 20);
  addCylinder(barrel, barrelRadius * 1.52, barrelLen * 0.13, [0, 0, frontZ + barrelLen], matMetal, [Math.PI / 2, 0, 0], 18);
  addCylinder(barrel, barrelRadius * 1.68, barrelLen * 0.035, [0, 0, frontZ + barrelLen * 1.06], matDetail, [Math.PI / 2, 0, 0], 18);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, frontZ + barrelLen * 1.1);
  barrel.add(muzzle);

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });

  return { group, turret, barrel, muzzle, recoilBase: 0 };
}
