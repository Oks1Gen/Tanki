import * as THREE from "three";
import type { TankModel } from "../types";

export interface TankSpec {
  id: TankModel;
  name: string;
  role: string;
  hull: { width: number; length: number; height: number };
  track: { width: number; height: number };
  turret: {
    type: "box" | "round" | "flat";
    radius: number;
    width: number;
    length: number;
    height: number;
  };
  barrel: { length: number; radius: number };
  // UI stat bars 0..1
  stats: { armor: number; speed: number; damage: number; reload: number };
  // gameplay
  maxSpeed: number;
  rotSpeed: number;
  turretRotSpeed: number;
  reloadTime: number;
  shellSpeed: number;
  damage: number;
  maxHealth: number;
}

export const TANK_SPECS: Record<TankModel, TankSpec> = {
  e100: {
    id: "e100",
    name: "E 100",
    role: "Тяжёлый танк",
    hull: { width: 4.4, length: 7.2, height: 1.05 },
    track: { width: 0.95, height: 0.95 },
    turret: { type: "box", radius: 2.2, width: 3.7, length: 4.4, height: 1.35 },
    barrel: { length: 4.8, radius: 0.45 },
    stats: { armor: 0.95, speed: 0.25, damage: 0.95, reload: 0.2 },
    maxSpeed: 9,
    rotSpeed: 0.75,
    turretRotSpeed: 1.0,
    reloadTime: 3.4,
    shellSpeed: 70,
    damage: 190,
    maxHealth: 2900,
  },
  t34: {
    id: "t34",
    name: "Т-34",
    role: "Средний танк",
    hull: { width: 3.0, length: 5.6, height: 0.92 },
    track: { width: 0.7, height: 0.8 },
    turret: { type: "round", radius: 1.55, width: 3.0, length: 3.0, height: 0.95 },
    barrel: { length: 3.7, radius: 0.23 },
    stats: { armor: 0.55, speed: 0.62, damage: 0.6, reload: 0.55 },
    maxSpeed: 16,
    rotSpeed: 1.5,
    turretRotSpeed: 2.1,
    reloadTime: 2.1,
    shellSpeed: 88,
    damage: 120,
    maxHealth: 1500,
  },
  t100lt: {
    id: "t100lt",
    name: "Т-100 ЛТ",
    role: "Лёгкий танк",
    hull: { width: 2.8, length: 5.9, height: 0.78 },
    track: { width: 0.62, height: 0.72 },
    turret: { type: "flat", radius: 1.4, width: 2.3, length: 2.7, height: 0.62 },
    barrel: { length: 4.0, radius: 0.16 },
    stats: { armor: 0.3, speed: 0.95, damage: 0.4, reload: 0.9 },
    maxSpeed: 27,
    rotSpeed: 2.1,
    turretRotSpeed: 3.1,
    reloadTime: 1.35,
    shellSpeed: 102,
    damage: 85,
    maxHealth: 950,
  },
};

export const TANK_ORDER: TankModel[] = ["e100", "t34", "t100lt"];

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

export function bodyColorFor(kind: "player" | "bot"): number {
  return kind === "player" ? BODY_COLOR_PLAYER : BODY_COLOR_BOT;
}

function makeStandard(color: number, rough = 0.6, metal = 0.4): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    envMapIntensity: 0.65,
  });
}

function armorGeometry(bottomWidth: number, topWidth: number, height: number, length: number, frontSlope: number) {
  const bw = bottomWidth / 2;
  const tw = topWidth / 2;
  const h = height / 2;
  const l = length / 2;
  // Tank hulls use +Z as the rear and -Z as the front; we therefore push the
  // front-top corners inwards to create the sloped glacis plate.
  const fz = l - frontSlope;
  const positions = new Float32Array([
    -bw, -h, -l, bw, -h, -l, bw, -h, l, -bw, -h, l,
    -tw, h, -l, tw, h, -l, tw, h, fz, -tw, h, fz,
  ]);
  // Outward winding: each face is ordered so its normal points away from the
  // box interior. Reversing this order is what made the textures look
  // "inside out" on the hulls.
  const indices = [
    // bottom (viewed from below)
    0, 2, 1, 0, 3, 2,
    // top (viewed from above)
    4, 6, 5, 4, 7, 6,
    // back (viewed from +Z)
    3, 2, 6, 3, 6, 7,
    // front + sloped glacis (viewed from -Z)
    0, 4, 5, 0, 5, 1,
    // left side (viewed from -X)
    0, 3, 7, 0, 7, 4,
    // right side (viewed from +X)
    1, 5, 6, 1, 6, 2,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  depth: number,
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
  segments = 18,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

export function createTankMesh(spec: TankSpec, kind: "player" | "bot"): TankMesh {
  const group = new THREE.Group();
  const bodyColor = bodyColorFor(kind);
  const matBody = makeStandard(bodyColor, 0.48, 0.38);
  const matBodyDark = makeStandard(kind === "player" ? 0x145da7 : 0x861f24, 0.58, 0.4);
  const matEdge = makeStandard(kind === "player" ? 0x0e477f : 0x68171b, 0.68, 0.35);
  const matTrack = makeStandard(TRACK_COLOR, 0.86, 0.55);
  const matRubber = makeStandard(0x111317, 0.95, 0.05);
  const matMetal = makeStandard(METAL_COLOR, 0.36, 0.78);
  const matDetail = makeStandard(DETAIL_COLOR, 0.52, 0.65);
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x09151c,
    roughness: 0.08,
    metalness: 0.75,
    emissive: 0x0d3348,
    emissiveIntensity: 0.55,
  });
  const matLight = new THREE.MeshStandardMaterial({
    color: 0xffedbf,
    emissive: 0xffc75a,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const trackX = spec.hull.width / 2 - spec.track.width / 2;
  const wheelR = spec.track.height * 0.43;
  const wheelCount = spec.id === "e100" ? 8 : spec.id === "t34" ? 5 : 6;
  const wheelSpan = spec.hull.length - wheelR * 2.6;
  const treadCount = Math.round(spec.hull.length / 0.34);
  const treadInstances = new THREE.InstancedMesh(
    new THREE.BoxGeometry(spec.track.width * 1.08, 0.09, spec.hull.length / treadCount * 0.78),
    matTrack,
    treadCount * 4,
  );
  const wheelInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR, wheelR, spec.track.width * 0.76, 20),
    matRubber,
    wheelCount * 2,
  );
  const hubInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR * 0.68, wheelR * 0.68, spec.track.width * 0.8, 18),
    matBodyDark,
    wheelCount * 2,
  );
  const boltInstances = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(wheelR * 0.18, wheelR * 0.18, spec.track.width * 0.84, 14),
    matMetal,
    wheelCount * 2,
  );
  const dummy = new THREE.Object3D();
  let treadIndex = 0;
  let wheelIndex = 0;

  const hullFrontZ = spec.hull.length / 2;
  const hullRearZ = -spec.hull.length / 2;
  const sprocketY = wheelR + 0.1;
  const returnRollerY = spec.track.height + 0.02;

  for (const side of [-1, 1]) {
    // Outer/inner track belt — two thin boxes forming the continuous loop.
    addBox(group, [spec.track.width, spec.track.height * 0.28, spec.hull.length], [side * trackX, spec.track.height * 0.15, 0], matTrack);
    addBox(group, [spec.track.width, spec.track.height * 0.24, spec.hull.length * 0.96], [side * trackX, spec.track.height * 0.86, 0], matTrack);

    // Individual track shoes on top and bottom of the loop.
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

    // Road wheels.
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

    // Drive sprocket at the rear and idler at the front — these keep the track
    // visually wrapped instead of ending flat.
    addCylinder(group, wheelR * 1.15, spec.track.width * 0.7, [side * trackX, sprocketY, hullRearZ + wheelR * 0.6], matMetal, [0, 0, Math.PI / 2], 14);
    addCylinder(group, wheelR * 0.95, spec.track.width * 0.72, [side * trackX, sprocketY, hullFrontZ - wheelR * 0.6], matMetal, [0, 0, Math.PI / 2], 14);
    // Teeth on the sprocket (8 small lugs around the rim).
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const r = wheelR * 1.15;
      addBox(
        group,
        [0.08, 0.18, spec.track.width * 0.55],
        [side * trackX, sprocketY + Math.sin(ang) * r, hullRearZ + wheelR * 0.6 + Math.cos(ang) * r],
        matMetal,
        [ang, 0, 0],
      );
    }

    // Upper return rollers (two small wheels that support the top run).
    for (const uz of [-spec.hull.length * 0.22, spec.hull.length * 0.22]) {
      addCylinder(group, wheelR * 0.42, spec.track.width * 0.55, [side * trackX, returnRollerY, uz], matMetal, [0, 0, Math.PI / 2], 12);
    }

    // Fender / over-track shelf.
    addBox(group, [spec.track.width * 1.12, 0.08, spec.hull.length * 1.02], [side * trackX, spec.track.height + 0.17, -0.03], matBodyDark);
    // Side skirt plate (thinner and closer to the wheels).
    addBox(group, [0.08, spec.track.height * 0.62, spec.hull.length * 0.82], [side * (spec.hull.width / 2 + 0.04), spec.track.height * 0.65, -0.1], matBodyDark);

    // Extra side armor skirt for heavy tanks (E 100).
    if (spec.id === "e100") {
      addBox(group, [0.12, spec.track.height * 0.95, spec.hull.length * 0.92], [side * (spec.hull.width / 2 + 0.08), spec.track.height * 0.55, 0], matEdge);
      // Three vertical reinforcing ribs so the skirt does not look like a flat sheet.
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
  const lower = new THREE.Mesh(
    armorGeometry(lowerW, lowerW * 0.88, lowerH, spec.hull.length * 0.94, lowerH * 0.58),
    matBodyDark,
  );
  lower.position.y = spec.track.height + lowerH / 2 - 0.02;
  group.add(lower);

  const upperH = spec.hull.height * 0.66;
  const upperW = spec.hull.width * (spec.id === "e100" ? 0.82 : 0.76);
  const upper = new THREE.Mesh(
    armorGeometry(upperW, upperW * 0.84, upperH, spec.hull.length * 0.72, upperH * 0.72),
    matBody,
  );
  const upperY = spec.track.height + lowerH + upperH / 2 - 0.08;
  upper.position.set(0, upperY, 0.08);
  group.add(upper);

  const deckY = upperY + upperH / 2 + 0.035;
  addBox(group, [upperW * 0.8, 0.08, spec.hull.length * 0.3], [0, deckY, -spec.hull.length * 0.2], matEdge);
  for (let i = -2; i <= 2; i++) {
    addBox(group, [upperW * 0.11, 0.035, spec.hull.length * 0.22], [i * upperW * 0.145, deckY + 0.055, -spec.hull.length * 0.23], matDetail);
  }

  // Front glacis plane and rear plane of the upper hull, used to mount details
  // flush to the surface (nothing floats in mid-air).
  const upperFrontZ = 0.08 + spec.hull.length * 0.34;
  const upperRearZ = 0.08 - spec.hull.length * 0.36;
  const fenderTopY = spec.track.height + 0.21;

  for (const side of [-1, 1]) {
    // Headlights mounted on the front plate.
    const lightX = side * upperW * 0.34;
    const lightY = upperY - upperH * 0.05;
    addCylinder(group, 0.16, 0.12, [lightX, lightY, upperFrontZ - 0.02], matDetail, [Math.PI / 2, 0, 0], 14);
    addCylinder(group, 0.12, 0.14, [lightX, lightY, upperFrontZ + 0.05], matLight, [Math.PI / 2, 0, 0], 14);
    // Exhaust muffler sitting on the rear fender.
    addCylinder(
      group,
      spec.id === "e100" ? 0.2 : 0.14,
      spec.hull.length * 0.34,
      [side * (spec.hull.width / 2 - spec.track.width * 0.15), fenderTopY + 0.05, upperRearZ + spec.hull.length * 0.06],
      matMetal,
      [Math.PI / 2, 0, 0],
      14,
    );
  }

  // Stowage box on the rear deck.
  addBox(group, [upperW * 0.5, 0.28, spec.hull.length * 0.16], [0, deckY + 0.16, upperRearZ + spec.hull.length * 0.08], matDetail);

  addBox(group, [0.12, 0.18, 0.42], [-upperW * 0.3, deckY + 0.1, spec.hull.length * 0.34], matEdge, [0, 0.35, 0]);
  addBox(group, [0.12, 0.18, 0.42], [upperW * 0.3, deckY + 0.1, spec.hull.length * 0.34], matEdge, [0, -0.35, 0]);

  // External fuel drums on T-34 — strapped to the rear fender with brackets.
  if (spec.id === "t34") {
    for (const side of [-1, 1]) {
      for (const z of [-1.65, -0.45]) {
        const drumY = fenderTopY + 0.24;
        addCylinder(group, 0.24, 1.0, [side * (spec.hull.width / 2 + 0.18), drumY, z], matBodyDark, [Math.PI / 2, 0, 0], 16);
        // End caps for the drum.
        addCylinder(group, 0.25, 0.06, [side * (spec.hull.width / 2 + 0.18), drumY, z + 0.5], matEdge, [Math.PI / 2, 0, 0], 16);
        addCylinder(group, 0.25, 0.06, [side * (spec.hull.width / 2 + 0.18), drumY, z - 0.5], matEdge, [Math.PI / 2, 0, 0], 16);
        // Two steel straps holding the drum to the fender.
        for (const dz of [-0.32, 0.32]) {
          addCylinder(group, 0.27, 0.05, [side * (spec.hull.width / 2 + 0.18), drumY, z + dz], matMetal, [Math.PI / 2, 0, 0], 16);
        }
        // Mounting bracket linking the drum to the hull side.
        addBox(group, [0.2, 0.18, 0.9], [side * (spec.hull.width / 2 + 0.04), drumY - 0.05, z], matEdge);
      }
    }
  }

  // Rear towing hooks (present on every vehicle) — flush against the back plate.
  for (const side of [-1, 1]) {
    addBox(group, [0.1, 0.2, 0.18], [side * upperW * 0.3, upperY - upperH * 0.2, upperRearZ - 0.08], matMetal);
    addCylinder(group, 0.07, 0.12, [side * upperW * 0.3, upperY - upperH * 0.35, upperRearZ - 0.14], matMetal, [Math.PI / 2, 0, 0], 10);
  }

  // Shovel / pioneer tool on the rear deck for medium tanks.
  if (spec.id === "t34") {
    addCylinder(group, 0.05, 1.2, [upperW * 0.2, deckY + 0.08, upperRearZ + 0.4], matMetal, [Math.PI / 2, 0, 0], 8);
    addBox(group, [0.24, 0.04, 0.3], [upperW * 0.2, deckY + 0.06, upperRearZ - 0.18], matDetail);
  }

  const turret = new THREE.Group();
  turret.position.set(0, deckY + 0.08, -spec.hull.length * 0.03);
  group.add(turret);
  const t = spec.turret;

  // Turret race ring so the rotating part reads clearly against the hull.
  addCylinder(turret, t.radius * 0.84, 0.16, [0, 0.02, 0], matEdge, [0, 0, 0], 32);
  addCylinder(turret, t.radius * 0.78, 0.04, [0, 0.12, 0], matDetail, [0, 0, 0], 32);

  // roofTopY tracks the actual top surface of the turret so every roof
  // accessory sits flush on it instead of floating above or sinking in.
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

  // --- Commander cupola (rear-left), resting on the roof ---
  const cupolaH = t.height * 0.32;
  const cupolaX = -t.radius * 0.32;
  const cupolaZ = -t.radius * 0.34;
  addCylinder(turret, t.radius * 0.24, cupolaH, [cupolaX, roofTopY + cupolaH / 2 - 0.02, cupolaZ], matBodyDark, [0, 0, 0], 20);
  addCylinder(turret, t.radius * 0.21, 0.06, [cupolaX, roofTopY + cupolaH, cupolaZ], matDetail, [0, 0, 0], 20);

  // --- Periscope / gun sight (front-right), flush on roof ---
  addBox(turret, [0.26, 0.2, 0.34], [t.radius * 0.3, roofTopY + 0.09, -t.radius * 0.08], matGlass);

  // --- Ventilation dome / hatch on centre roof ---
  addCylinder(turret, t.radius * 0.16, 0.08, [t.radius * 0.05, roofTopY + 0.03, -t.radius * 0.02], matDetail, [0, 0, 0], 18);

  // --- Antenna: base bolted to the rear of the roof, mast rising straight up ---
  const antennaX = -t.radius * 0.42;
  const antennaZ = -t.radius * 0.48;
  const mastLen = 1.7;
  addCylinder(turret, 0.07, 0.14, [antennaX, roofTopY + 0.06, antennaZ], matDetail, [0, 0, 0], 10);
  const antenna = addCylinder(turret, 0.022, mastLen, [antennaX, roofTopY + 0.12 + mastLen / 2, antennaZ], matDetail, [0, 0, 0], 6);
  antenna.rotation.x = spec.id === "t100lt" ? 0.08 : 0.04;

  const barrelLen = spec.barrel.length;
  const barrelRadius = spec.barrel.radius;
  const frontZ = (t.type === "round" ? t.radius : t.length / 2) + 0.02;
  const barrelY = t.height * (t.type === "round" ? 0.55 : 0.5);
  const mantlet = addCylinder(
    turret,
    barrelRadius * 2.05,
    Math.max(0.34, t.height * 0.48),
    [0, barrelY, frontZ],
    matBodyDark,
    [Math.PI / 2, 0, 0],
    20,
  );
  mantlet.scale.x = 1.22;

  const barrel = new THREE.Group();
  barrel.position.set(0, barrelY, 0);
  turret.add(barrel);
  addCylinder(
    barrel,
    barrelRadius,
    barrelLen,
    [0, 0, frontZ + barrelLen / 2],
    matMetal,
    [Math.PI / 2, 0, 0],
    20,
  );
  addCylinder(barrel, barrelRadius * 1.3, barrelLen * 0.18, [0, 0, frontZ + barrelLen * 0.17], matDetail, [Math.PI / 2, 0, 0], 20);
  addCylinder(barrel, barrelRadius * 1.52, barrelLen * 0.13, [0, 0, frontZ + barrelLen], matMetal, [Math.PI / 2, 0, 0], 18);
  addCylinder(barrel, barrelRadius * 1.68, barrelLen * 0.035, [0, 0, frontZ + barrelLen * 1.06], matDetail, [Math.PI / 2, 0, 0], 18);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, frontZ + barrelLen * 1.1);
  barrel.add(muzzle);

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return { group, turret, barrel, muzzle, recoilBase: 0 };
}
