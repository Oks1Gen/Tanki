import * as THREE from "three";
import type { GameSettings, GameResult, HudState } from "../types";
import { createTankMesh, TANK_ORDER, TANK_SPECS, type TankMesh, type TankSpec } from "./tanks";

const MAP_HALF = 78;
const RECOIL = 0.7;
const FIRE_RANGE = 130;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function damp(a: number, b: number, lambda: number, dt: number) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
function normalizeAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
function angleDiff(a: number, b: number) {
  return normalizeAngle(b - a);
}
function rotateToward(cur: number, target: number, maxStep: number) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return normalizeAngle(cur + Math.sign(d) * maxStep);
}
function forward(a: number) {
  return new THREE.Vector2(Math.sin(a), Math.cos(a));
}

function addWorldBox(
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

interface Obstacle {
  box: THREE.Box3;
  mesh: THREE.Object3D;
}

interface Tank {
  spec: TankSpec;
  mesh: TankMesh;
  hullAngle: number;
  turretAngle: number;
  velocity: number;
  health: number;
  reload: number;
  recoil: number;
  isPlayer: boolean;
  dead: boolean;
  radius: number;
  aiWander: number;
  aiTimer: number;
  aiTarget: Tank | null;
  targetTimer: number;
  blocked: number;
  barrelPitch: number;
}

interface Shell {
  group: THREE.Group;
  vel: THREE.Vector3;
  life: number;
  owner: Tank;
  damage: number;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
}
interface Effect {
  group: THREE.Group;
  age: number;
  life: number;
  light: THREE.PointLight | null;
  sparks: Spark[];
  grow: THREE.Mesh[];
  update: (dt: number) => boolean;
}

export interface GameCallbacks {
  onHud: (s: HudState) => void;
  onEnd: (r: GameResult) => void;
  onPause: (paused: boolean) => void;
  onAim: (x: number, y: number) => void;
}

export class TankGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private settings: GameSettings;
  private cb: GameCallbacks;

  private player!: Tank;
  private bots: Tank[] = [];
  private allTanks: Tank[] = [];
  private shells: Shell[] = [];
  private effects: Effect[] = [];
  private obstacles: Obstacle[] = [];

  private keys: Record<string, boolean> = {};
  private yaw = 0;
  private pitch = 0.035;
  private aimNdc = new THREE.Vector2(0, 0);
  private locked = false;
  private paused = true;
  private ended: GameResult = null;
  private kills = 0;

  private raycaster = new THREE.Raycaster();
  private hudAccum = 0;
  private baseFov = 64;
  private shake = 0;
  private shakeDecay = 6;

  // reusable resources
  private shellGeo!: THREE.SphereGeometry;
  private shellMat!: THREE.MeshBasicMaterial;
  private trailMat!: THREE.MeshBasicMaterial;
  private sparkGeo!: THREE.SphereGeometry;
  private flashGeo!: THREE.SphereGeometry;

  constructor(canvas: HTMLCanvasElement, settings: GameSettings, cb: GameCallbacks) {
    this.settings = settings;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8ea4ae, 0.0052);

    this.baseFov = 64;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.camera.position.set(0, 12, 22);

    this.initResources();
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildObstacles();
    this.buildScenery();
    this.spawnTanks();
    this.snapCamera();

    this.bindEvents();
    this.pushHud();
    this.cb.onAim(this.aimNdc.x, this.aimNdc.y);
  }

  // ---------- setup ----------
  private initResources() {
    this.shellGeo = new THREE.SphereGeometry(0.22, 10, 10);
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    this.trailMat = new THREE.MeshBasicMaterial({
      color: 0xffae3b,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkGeo = new THREE.SphereGeometry(0.16, 6, 6);
    this.flashGeo = new THREE.SphereGeometry(1, 12, 12);
  }

  private buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x18324f) },
        mid: { value: new THREE.Color(0x7896aa) },
        bot: { value: new THREE.Color(0xd4c4a5) },
        sunDir: { value: new THREE.Vector3(0.45, 0.68, 0.34).normalize() },
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir;
        void main(){
          vec3 dir = normalize(vPos);
          float h = dir.y;
          vec3 col = mix(bot, mid, smoothstep(-0.1, 0.25, h));
          col = mix(col, top, smoothstep(0.2, 0.75, h));
          float sun = pow(max(dot(dir, sunDir), 0.0), 180.0);
          float glow = pow(max(dot(dir, sunDir), 0.0), 12.0);
          col += vec3(1.0, 0.62, 0.28) * glow * 0.22 + vec3(1.0, 0.9, 0.65) * sun * 2.0;
          gl_FragColor = vec4(col,1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xbdd8ee, 0x343326, 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe2b3, 2.55);
    sun.position.set(60, 95, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    const s = 95;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }
  private sun!: THREE.DirectionalLight;

  private buildGround() {
    const tex = this.makeGroundTexture();
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2 + 40, MAP_HALF * 2 + 40);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // perimeter wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x474a4c, roughness: 0.94 });
    const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x26292c, roughness: 0.78, metalness: 0.2 });
    const wallH = 4;
    const span = MAP_HALF * 2;
    const configs: [number, number, number, number, number, number][] = [
      [span + 4, wallH, 2, 0, 0, MAP_HALF + 1],
      [span + 4, wallH, 2, 0, 0, -MAP_HALF - 1],
      [2, wallH, span + 4, MAP_HALF + 1, 0, 0],
      [2, wallH, span + 4, -MAP_HALF - 1, 0, 0],
    ];
    for (const [w, h, d, x, y, z] of configs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.obstacles.push({ box: new THREE.Box3().setFromObject(m), mesh: m });

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.16, d + 0.16), wallCapMat);
      cap.position.set(x, y + h + 0.08, z);
      cap.castShadow = true;
      this.scene.add(cap);
    }

    this.buildRoads();
  }
  private ground!: THREE.Mesh;

  private makeGroundTexture(): THREE.Texture {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4a5134";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 16 + 1;
      const shade = Math.random();
      const g = shade > 0.5 ? 78 + Math.random() * 36 : 45 + Math.random() * 24;
      ctx.fillStyle = `rgba(${42 + Math.random() * 34},${g},${28 + Math.random() * 22},${0.2 + Math.random() * 0.34})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = 3 + Math.random() * 10;
      ctx.strokeStyle = `rgba(205,190,145,${0.06 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + (Math.random() - 0.5) * 5);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(10, 10);
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  private buildRoads() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#766547";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 900; i++) {
      const shade = 70 + Math.random() * 75;
      ctx.fillStyle = `rgba(${shade},${shade * 0.84},${shade * 0.58},${0.08 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 512, 1 + Math.random() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(38,34,27,0.25)";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(55, 0);
    ctx.lineTo(55, 512);
    ctx.moveTo(201, 0);
    ctx.lineTo(201, 512);
    ctx.stroke();
    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.colorSpace = THREE.SRGBColorSpace;
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 7);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 1,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const routes: [number, number, number, number][] = [
      [7.5, 170, -16, 0.1],
      [6.5, 145, 27, Math.PI / 2.8],
      [5.5, 110, -35, -Math.PI / 3.8],
    ];
    for (const [width, length, offset, angle] of routes) {
      const roadGeo = new THREE.PlaneGeometry(width, length, 1, 1);
      roadGeo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.position.set(angle === 0.1 ? offset : 0, 0.018, angle === 0.1 ? 0 : offset);
      road.rotation.y = angle;
      road.receiveShadow = true;
      this.scene.add(road);
    }
  }

  private buildObstacles() {
    const placeObstacle = (mesh: THREE.Object3D, x: number, z: number) => {
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      this.obstacles.push({ box, mesh });
    };

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x777772, roughness: 0.92 });
    const concreteDark = new THREE.MeshStandardMaterial({ color: 0x4a4b49, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x292d30, roughness: 0.72, metalness: 0.25 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x172028,
      roughness: 0.2,
      metalness: 0.65,
      emissive: 0x111923,
      emissiveIntensity: 0.28,
    });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x80542d, roughness: 0.86 });
    const crateEdgeMat = new THREE.MeshStandardMaterial({ color: 0x3f2a19, roughness: 0.9 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x535754, roughness: 1 });
    const rockDarkMat = new THREE.MeshStandardMaterial({ color: 0x393d3b, roughness: 1 });

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const isFarFromCenter = (x: number, z: number) => Math.hypot(x, z) > 14;

    const makeBuilding = (w: number, d: number, h: number) => {
      const building = new THREE.Group();
      addWorldBox(building, [w, h, d], [0, h / 2, 0], concreteMat);
      addWorldBox(building, [w + 0.35, 0.28, d + 0.35], [0, h + 0.14, 0], roofMat);
      addWorldBox(building, [w * 0.34, 0.8, d * 0.32], [0, h + 0.54, 0], roofMat);
      addWorldBox(building, [w * 0.22, 2.4, 0.08], [0, 1.2, d / 2 + 0.045], concreteDark);
      const floors = Math.max(1, Math.floor((h - 1.4) / 2.2));
      const columns = Math.max(2, Math.floor(w / 2.4));
      for (let floor = 0; floor < floors; floor++) {
        for (let col = 0; col < columns; col++) {
          const wx = -w * 0.34 + col * ((w * 0.68) / Math.max(1, columns - 1));
          const wy = 1.6 + floor * 2.15;
          if (wy > h - 0.55) continue;
          addWorldBox(building, [0.82, 0.72, 0.07], [wx, wy, d / 2 + 0.055], windowMat);
          addWorldBox(building, [0.82, 0.72, 0.07], [wx, wy, -d / 2 - 0.055], windowMat);
        }
      }
      return building;
    };

    const makeBarrier = () => {
      const barrier = new THREE.Group();
      for (let i = -2; i <= 2; i++) {
        const block = addWorldBox(barrier, [2.2, 1.45, 1.0], [i * 2.05, 0.73, Math.abs(i) * 0.32], concreteMat);
        block.rotation.z = i * 0.018;
        addWorldBox(barrier, [2.28, 0.16, 1.08], [i * 2.05, 1.48, Math.abs(i) * 0.32], concreteDark);
      }
      return barrier;
    };

    const makeCrates = () => {
      const crates = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const size = rand(1.45, 2.1);
        const x = (i % 2) * 1.7 - 0.85 + rand(-0.15, 0.15);
        const z = Math.floor(i / 2) * 1.65 - 0.8 + rand(-0.15, 0.15);
        const y = size / 2;
        addWorldBox(crates, [size, size, size], [x, y, z], crateMat, [0, rand(-0.12, 0.12), 0]);
        addWorldBox(crates, [size * 1.04, 0.12, 0.15], [x, y + size * 0.34, z + size / 2 + 0.02], crateEdgeMat);
        addWorldBox(crates, [size * 1.04, 0.12, 0.15], [x, y - size * 0.34, z + size / 2 + 0.02], crateEdgeMat);
      }
      return crates;
    };

    const makeRocks = () => {
      const rocks = new THREE.Group();
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const radius = rand(1.45, 3.0);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), i % 2 ? rockMat : rockDarkMat);
        rock.position.set(rand(-2.6, 2.6), radius * 0.55, rand(-2.4, 2.4));
        rock.scale.set(rand(0.85, 1.25), rand(0.55, 0.9), rand(0.8, 1.2));
        rock.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI), rand(-0.18, 0.18));
        rocks.add(rock);
      }
      return rocks;
    };

    let attempts = 0;
    let placed = 0;
    while (placed < 22 && attempts < 500) {
      attempts++;
      const x = rand(-MAP_HALF + 8, MAP_HALF - 8);
      const z = rand(-MAP_HALF + 8, MAP_HALF - 8);
      if (!isFarFromCenter(x, z)) continue;
      // avoid overlapping existing
      let ok = true;
      for (const o of this.obstacles) {
        if (
          Math.abs(x - (o.box.min.x + o.box.max.x) / 2) < 10 &&
          Math.abs(z - (o.box.min.z + o.box.max.z) / 2) < 10
        ) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const kind = Math.random();
      let obstacle: THREE.Object3D;
      if (kind < 0.42) {
        obstacle = makeBuilding(rand(5.5, 9), rand(5.5, 9), rand(4.5, 9.5));
      } else if (kind < 0.62) {
        obstacle = makeBarrier();
      } else if (kind < 0.82) {
        obstacle = makeCrates();
      } else {
        obstacle = makeRocks();
      }
      obstacle.rotation.y = Math.round(Math.random() * 3) * (Math.PI / 2) + rand(-0.08, 0.08);
      obstacle.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      placeObstacle(obstacle, x, z);
      placed++;
    }
  }

  private buildScenery() {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const dummy = new THREE.Object3D();

    const grassGeo = new THREE.ConeGeometry(0.18, 0.75, 4);
    grassGeo.translate(0, 0.375, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x68733d, roughness: 1 });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, 320);
    let grassIndex = 0;
    while (grassIndex < 320) {
      const x = rand(-MAP_HALF + 3, MAP_HALF - 3);
      const z = rand(-MAP_HALF + 3, MAP_HALF - 3);
      if (Math.hypot(x, z) < 8 || this.pointBlocked(x, z, 0.5)) continue;
      const scale = rand(0.55, 1.45);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rand(0, Math.PI), rand(-0.15, 0.15));
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      grass.setMatrixAt(grassIndex++, dummy.matrix);
    }
    grass.castShadow = true;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 3.8, 7);
    const crownGeo = new THREE.ConeGeometry(2.2, 5.2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3623, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f462d, roughness: 1 });
    const trees = 54;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees);
    for (let i = 0; i < trees; i++) {
      const angle = (i / trees) * Math.PI * 2 + rand(-0.08, 0.08);
      const radius = rand(MAP_HALF + 7, MAP_HALF + 25);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = rand(0.75, 1.35);
      dummy.position.set(x, 1.9 * scale, z);
      dummy.rotation.set(0, rand(0, Math.PI), 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 5.1 * scale, z);
      dummy.rotation.set(0, rand(0, Math.PI), 0);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.scene.add(trunks, crowns);

    const craterMat = new THREE.MeshStandardMaterial({ color: 0x302d25, roughness: 1 });
    for (let i = 0; i < 13; i++) {
      const x = rand(-MAP_HALF + 10, MAP_HALF - 10);
      const z = rand(-MAP_HALF + 10, MAP_HALF - 10);
      if (this.pointBlocked(x, z, 2)) continue;
      const crater = new THREE.Mesh(new THREE.TorusGeometry(rand(0.8, 1.7), 0.16, 7, 18), craterMat);
      crater.rotation.x = Math.PI / 2;
      crater.scale.y = rand(0.72, 1.15);
      crater.position.set(x, 0.045, z);
      crater.receiveShadow = true;
      this.scene.add(crater);
    }

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x5d6665, roughness: 1, flatShading: true });
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = rand(150, 205);
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(rand(18, 32), rand(28, 55), 7), mountainMat);
      mountain.position.set(Math.cos(angle) * radius, mountain.geometry.parameters.height / 2 - 5, Math.sin(angle) * radius);
      mountain.scale.z = rand(0.65, 1.4);
      this.scene.add(mountain);
    }
  }

  private makeTank(spec: TankSpec, kind: "player" | "bot"): Tank {
    const mesh = createTankMesh(spec, kind);
    return {
      spec,
      mesh,
      hullAngle: 0,
      turretAngle: 0,
      velocity: 0,
      health: spec.maxHealth,
      reload: 0,
      recoil: 0,
      isPlayer: kind === "player",
      dead: false,
      radius: Math.max(spec.hull.width / 2, 2.0),
      aiWander: 0,
      aiTimer: 0,
      aiTarget: null,
      targetTimer: 0,
      blocked: 0,
      barrelPitch: 0,
    };
  }

  private spawnTanks() {
    // player
    const playerSpec = TANK_SPECS[this.settings.tankModel];
    const player = this.makeTank(playerSpec, "player");
    player.mesh.group.position.set(0, 0, 0);
    // face into the screen (away from the behind-camera) so W drives forward
    player.hullAngle = Math.PI;
    this.scene.add(player.mesh.group);
    this.player = player;

    // bots
    const count = clamp(this.settings.botCount, 1, 12);
    for (let i = 0; i < count; i++) {
      const model = TANK_ORDER[i % TANK_ORDER.length];
      const spec = TANK_SPECS[model];
      const bot = this.makeTank(spec, "bot");
      const pos = this.findSpawn();
      bot.mesh.group.position.set(pos.x, 0, pos.y);
      bot.hullAngle = Math.atan2(-pos.x, -pos.y);
      this.scene.add(bot.mesh.group);
      this.bots.push(bot);
    }
    this.allTanks = [this.player, ...this.bots];
  }

  private findSpawn(): THREE.Vector2 {
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * (MAP_HALF - 36);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (this.pointBlocked(x, z, 3)) continue;
      return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(30, 30);
  }

  private pointBlocked(x: number, z: number, pad: number): boolean {
    for (const o of this.obstacles) {
      const b = o.box;
      if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) return true;
    }
    return false;
  }

  // ---------- events ----------
  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
  }
  private unbindEvents() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouseDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    if (!this.locked) this.keys = {};
    const wantPause = !this.locked && this.ended === null;
    if (wantPause !== this.paused) {
      this.paused = wantPause;
      this.cb.onPause(this.paused);
    }
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);
    this.aimNdc.x = clamp(this.aimNdc.x + (e.movementX * 2) / width, -0.82, 0.82);
    this.aimNdc.y = clamp(this.aimNdc.y - (e.movementY * 2) / height, -0.68, 0.68);
    this.cb.onAim(this.aimNdc.x, this.aimNdc.y);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.locked) {
      this.lockPointer();
      return;
    }
    this.firePlayer();
  };

  private lockPointer() {
    const el = this.renderer.domElement;
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.then === "function") p.catch(() => {});
  }

  requestLock() {
    this.lockPointer();
  }

  // ---------- loop ----------
  start() {
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private update(dt: number) {
    if (!this.paused && this.ended === null) {
      this.updatePlayer(dt);
      for (const b of this.bots) this.updateBot(b, dt);
    }
    if (!this.paused) {
      this.updateShells(dt);
      this.updateEffects(dt);
      this.applyRecoil(dt);
    }
    this.updateCamera();
    this.updateSun();

    this.hudAccum += dt;
    if (this.hudAccum > 0.1) {
      this.hudAccum = 0;
      this.pushHud();
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.dead) return;
    p.reload = Math.max(0, p.reload - dt);

    const accel = (this.keys["KeyW"] || this.keys["ArrowUp"] ? 1 : 0) - (this.keys["KeyS"] || this.keys["ArrowDown"] ? 1 : 0);
    const turn = (this.keys["KeyA"] || this.keys["ArrowLeft"] ? 1 : 0) - (this.keys["KeyD"] || this.keys["ArrowRight"] ? 1 : 0);
    p.hullAngle += turn * p.spec.rotSpeed * dt;
    const targetVel = accel * p.spec.maxSpeed;
    p.velocity = damp(p.velocity, targetVel, 6, dt);

    this.moveTank(p, dt);

    // The camera starts turning only near the sight limits, while the sight itself
    // remains freely movable across most of the screen.
    const edgeX = Math.max(0, Math.abs(this.aimNdc.x) - 0.55);
    const edgeY = Math.max(0, Math.abs(this.aimNdc.y) - 0.42);
    this.yaw -= Math.sign(this.aimNdc.x) * edgeX * 2.2 * dt;
    this.pitch = clamp(
      this.pitch - Math.sign(this.aimNdc.y) * edgeY * 1.35 * dt,
      -0.16,
      0.34,
    );

    // Lock the turret to the live aim direction so the gun always points at
    // the crosshair — no more lag, no more snappy catch-up.
    const aimDir = this.getAimDirection();
    const azimuth = Math.atan2(aimDir.x, aimDir.z);
    p.turretAngle = this.desiredTurretAngle = azimuth - p.hullAngle;
    p.barrelPitch = clamp(-Math.asin(clamp(aimDir.y, -1, 1)), -0.42, 0.32);
    this.syncTank(p);

    if (this.keys["Space"]) this.firePlayer();
  }
  private desiredTurretAngle = 0;

  // expose for AI bots so they can keep the barrel locked to their target.

  private updateBot(b: Tank, dt: number) {
    if (b.dead) return;
    b.reload = Math.max(0, b.reload - dt);

    b.targetTimer -= dt;
    if (b.targetTimer <= 0 || !b.aiTarget || b.aiTarget.dead) {
      b.aiTarget = this.findNearestTarget(b);
      b.targetTimer = 0.8 + Math.random() * 0.8;
    }
    const target = b.aiTarget;
    if (!target) {
      b.velocity = damp(b.velocity, 0, 5, dt);
      return;
    }

    const pp = target.mesh.group.position;
    const bp = b.mesh.group.position;
    const dx = pp.x - bp.x;
    const dz = pp.z - bp.z;
    const dist = Math.hypot(dx, dz);
    const desiredHull = Math.atan2(dx, dz);

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) {
      b.aiTimer = 1.2 + Math.random() * 2.2;
      b.aiWander = (Math.random() - 0.5) * (b.blocked > 0 ? 1.6 : 0.5);
    }

    // Snap the turret directly to the target — the same feel the player gets.
    const desiredTurret = Math.atan2(dx, dz);
    b.turretAngle = desiredTurret - b.hullAngle;
    const elevation = Math.atan2(this.tankAimHeight(target) - this.tankAimHeight(b), Math.max(1, dist));
    b.barrelPitch = clamp(-elevation, -0.42, 0.32);

    const engage = 26;
    let speed = 0;
    if (dist > engage) speed = b.spec.maxSpeed * 0.85;
    else if (dist < engage * 0.55) speed = -b.spec.maxSpeed * 0.4;
    if (b.blocked > 0.05) speed = b.spec.maxSpeed * 0.6;

    b.velocity = damp(b.velocity, speed, 4, dt);
    b.hullAngle = rotateToward(b.hullAngle, desiredHull + b.aiWander, b.spec.rotSpeed * dt);
    this.moveTank(b, dt);

    this.syncTank(b);

    // fire
    const worldTurret = b.hullAngle + b.turretAngle;
    const facingErr = Math.abs(angleDiff(worldTurret, desiredTurret));
    const canSee = dist < FIRE_RANGE && this.lineOfSight(bp.x, bp.z, pp.x, pp.z);
    if (b.reload <= 0 && dist < FIRE_RANGE && canSee && facingErr < 0.22) {
      this.fireTank(b, target);
    }
  }

  private findNearestTarget(seeker: Tank): Tank | null {
    let chosen: Tank | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const sp = seeker.mesh.group.position;
    for (const candidate of this.allTanks) {
      if (candidate === seeker || candidate.dead) continue;
      const cp = candidate.mesh.group.position;
      const distance = Math.hypot(cp.x - sp.x, cp.z - sp.z);
      // A small random factor prevents every bot from selecting the same target.
      const score = distance * (0.88 + Math.random() * 0.24);
      if (score < bestScore) {
        bestScore = score;
        chosen = candidate;
      }
    }
    return chosen;
  }

  private tankAimHeight(tank: Tank): number {
    return tank.mesh.group.position.y + tank.spec.track.height + tank.spec.hull.height + 0.65;
  }

  private syncTank(t: Tank) {
    t.mesh.group.rotation.y = t.hullAngle;
    t.mesh.turret.rotation.y = t.turretAngle;
    t.mesh.barrel.rotation.x = t.barrelPitch;
  }

  private moveTank(t: Tank, dt: number) {
    const f = forward(t.hullAngle);
    const pos = t.mesh.group.position;
    const nx = pos.x + f.x * t.velocity * dt;
    const nz = pos.z + f.y * t.velocity * dt;
    const before = new THREE.Vector2(nx, nz);
    this.resolveCollision(before, t.radius);
    const moved = Math.hypot(before.x - nx, before.y - nz);
    if (moved > 0.001 && t.velocity > 0.1) {
      t.blocked = damp(t.blocked, moved > 0.2 ? 1 : 0, 8, dt);
    } else {
      t.blocked = damp(t.blocked, 0, 4, dt);
    }
    pos.x = before.x;
    pos.z = before.y;

    // separate from other tanks
    for (const o of this.allTanks) {
      if (o === t || o.dead) continue;
      const op = o.mesh.group.position;
      const ddx = pos.x - op.x;
      const ddz = pos.z - op.z;
      const dd = Math.hypot(ddx, ddz);
      const min = t.radius + o.radius;
      if (dd > 0.0001 && dd < min) {
        const push = (min - dd) / 2;
        const ux = ddx / dd;
        const uz = ddz / dd;
        pos.x += ux * push;
        pos.z += uz * push;
      }
    }
  }

  private resolveCollision(pos: THREE.Vector2, radius: number) {
    for (const o of this.obstacles) {
      const orig = o.box;
      const expanded = orig.clone().expandByScalar(radius);
      if (expanded.containsPoint(new THREE.Vector3(pos.x, 1, pos.y))) {
        // Push out to the original box boundary + radius
        const dl = pos.x - orig.min.x + radius;
        const dr = orig.max.x + radius - pos.x;
        const dn = pos.y - orig.min.z + radius;
        const df = orig.max.z + radius - pos.y;
        const m = Math.min(dl, dr, dn, df);
        if (m === dl) pos.x = orig.min.x - radius;
        else if (m === dr) pos.x = orig.max.x + radius;
        else if (m === dn) pos.y = orig.min.z - radius;
        else pos.y = orig.max.z + radius;
      }
    }
    pos.x = clamp(pos.x, -MAP_HALF + radius, MAP_HALF - radius);
    pos.y = clamp(pos.y, -MAP_HALF + radius, MAP_HALF - radius);
  }

  private lineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
    for (const o of this.obstacles) {
      const b = o.box;
      // slab test in XZ (ignore y) with small vertical check
      if (b.max.y < 1) continue;
      if (this.segmentAabbXZ(x1, z1, x2, z2, b.min.x, b.min.z, b.max.x, b.max.z)) return false;
    }
    return true;
  }

  private segmentAabbXZ(
    x1: number, z1: number, x2: number, z2: number,
    minx: number, minz: number, maxx: number, maxz: number,
  ): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    let tmin = 0;
    let tmax = 1;
    const sweep = (p: number, d: number, lo: number, hi: number) => {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) return false;
        return true;
      }
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      return tmax >= tmin;
    };
    if (!sweep(x1, dx, minx, maxx)) return false;
    if (!sweep(z1, dz, minz, maxz)) return false;
    return tmax >= tmin && tmin <= 1 && tmax >= 0;
  }

  // ---------- camera ----------
  private getAimDirection(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.aimNdc, this.camera);
    return this.raycaster.ray.direction.clone().normalize();
  }

  private snapCamera() {
    const p = this.player.mesh.group.position;
    const dist = 16;
    this.camera.position.set(
      p.x + Math.sin(this.yaw) * dist,
      p.y + 8.7,
      p.z + Math.cos(this.yaw) * dist,
    );
    this.lookCameraForward();
  }

  private updateCamera() {
    const p = this.player.mesh.group.position;
    const dist = 16;
    const desired = new THREE.Vector3(
      p.x + Math.sin(this.yaw) * dist,
      p.y + 8.7,
      p.z + Math.cos(this.yaw) * dist,
    );
    this.camera.position.lerp(desired, this.paused ? 0 : 0.4);
    // FOV widens slightly with speed and zooms in when zoomed.
    const speedFactor = Math.min(0.06, this.player.velocity / 220);
    this.desiredTurretAngle += 0; // keep hot-reload happy
    this.camera.fov = this.baseFov + speedFactor * 10;
    this.camera.updateProjectionMatrix();
    this.lookCameraForward();
  }

  private lookCameraForward() {
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * cp,
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    );
    // Add subtle shake so impacts and gunshots feel weighty.
    if (this.shake > 0.001) {
      dir.x += (Math.random() - 0.5) * this.shake * 0.05;
      dir.y += (Math.random() - 0.5) * this.shake * 0.04;
      dir.z += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake = Math.max(0, this.shake - this.shakeDecay * 0.016);
    }
    this.camera.lookAt(this.camera.position.clone().addScaledVector(dir, 50));
  }

  private updateSun() {
    const p = this.player.mesh.group.position;
    this.sun.position.set(p.x + 60, 95, p.z + 40);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  // ---------- firing ----------
  private applyRecoil(dt: number) {
    for (const t of this.allTanks) {
      if (t.dead) continue;
      t.recoil = damp(t.recoil, 0, 14, dt);
      t.mesh.barrel.position.z = -t.recoil;
    }
  }

  private computeAimPoint(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.aimNdc, this.camera);
    const targets: THREE.Object3D[] = [this.ground];
    for (const o of this.obstacles) targets.push(o.mesh);
    for (const b of this.bots) if (!b.dead) targets.push(b.mesh.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length) return hits[0].point.clone();
    return this.raycaster.ray.at(FIRE_RANGE, new THREE.Vector3());
  }

  private firePlayer() {
    this.fireTank(this.player);
  }

  private fireTank(t: Tank, target?: Tank) {
    if (t.dead || t.reload > 0) return;
    if (!t.isPlayer && (!target || target.dead)) return;
    t.reload = t.spec.reloadTime;
    t.recoil = RECOIL;

    const muzzleWorld = new THREE.Vector3();
    t.mesh.muzzle.getWorldPosition(muzzleWorld);

    let dir: THREE.Vector3;
    if (t.isPlayer) {
      const aim = this.computeAimPoint();
      dir = aim.sub(muzzleWorld).normalize();
    } else {
      if (!target) return;
      const tp = target.mesh.group.position;
      const aim = new THREE.Vector3(tp.x, this.tankAimHeight(target), tp.z);
      dir = aim.sub(muzzleWorld).normalize();
      // small inaccuracy so bots are beatable
      const ang = (Math.random() - 0.5) * 0.06;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      dir = new THREE.Vector3(
        dir.x * ca - dir.z * sa,
        dir.y + (Math.random() - 0.5) * 0.018,
        dir.x * sa + dir.z * ca,
      ).normalize();
    }
    const vel = dir.clone().multiplyScalar(t.spec.shellSpeed);
    this.spawnShell(muzzleWorld, vel, t, t.spec.damage);
    this.spawnMuzzleFlash(muzzleWorld, dir);
    if (t.isPlayer) {
      this.shake = Math.max(this.shake, 0.55);
    } else {
      this.shake = Math.max(this.shake, 0.3);
    }
  }

  private spawnShell(origin: THREE.Vector3, vel: THREE.Vector3, owner: Tank, damage: number) {
    const group = new THREE.Group();
    const tip = new THREE.Mesh(this.shellGeo, this.shellMat);
    group.add(tip);
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.6), this.trailMat);
    trail.position.z = -1.4;
    group.add(trail);
    group.position.copy(origin);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());
    group.quaternion.copy(q);
    this.scene.add(group);
    this.shells.push({ group, vel, life: 3.2, owner, damage });
  }

  private updateShells(dt: number) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      const previous = s.group.position.clone();
      const next = previous.clone().addScaledVector(s.vel, dt);
      const segment = new THREE.Line3(previous, next);
      const travel = next.clone().sub(previous);
      const travelLength = travel.length();
      const ray = new THREE.Ray(previous, travelLength > 0 ? travel.clone().normalize() : new THREE.Vector3(0, 0, 1));

      let hitPoint: THREE.Vector3 | null = null;
      let hitTarget: Tank | null = null;
      let nearestHit = Number.POSITIVE_INFINITY;

      const considerHit = (point: THREE.Vector3, target: Tank | null = null) => {
        const distance = previous.distanceTo(point);
        if (distance <= travelLength + 0.001 && distance < nearestHit) {
          nearestHit = distance;
          hitPoint = point.clone();
          hitTarget = target;
        }
      };

      if (previous.y > 0.3 && next.y <= 0.3) {
        const alpha = (previous.y - 0.3) / Math.max(0.0001, previous.y - next.y);
        considerHit(previous.clone().lerp(next, alpha).setY(0.3));
      } else if (next.y <= 0.3) {
        considerHit(next.clone().setY(0.3));
      }

      for (const o of this.obstacles) {
        const point = ray.intersectBox(o.box, new THREE.Vector3());
        if (point) considerHit(point);
      }

      for (const target of this.allTanks) {
        if (target === s.owner || target.dead) continue;
        const center = new THREE.Vector3(
          target.mesh.group.position.x,
          this.tankAimHeight(target),
          target.mesh.group.position.z,
        );
        const closest = segment.closestPointToPoint(center, true, new THREE.Vector3());
        if (closest.distanceTo(center) <= target.radius + 0.45) {
          considerHit(closest, target);
        }
      }

      s.group.position.copy(hitPoint ?? next);
      const consumed = hitPoint !== null;
      if (hitPoint) {
        if (hitTarget) this.hitTank(hitTarget, s.damage, hitPoint, s.owner);
        else this.spawnImpact(hitPoint, 0.9);
      }

      if (consumed || s.life <= 0) {
        this.scene.remove(s.group);
        const trailMesh = s.group.children[1] as THREE.Mesh | undefined;
        if (trailMesh?.geometry) trailMesh.geometry.dispose();
        this.shells.splice(i, 1);
      }
    }
  }

  private hitTank(target: Tank, damage: number, point: THREE.Vector3, attacker: Tank) {
    target.health -= damage;
    this.spawnImpact(point, 1.4);
    if (target.isPlayer) {
      this.triggerDamageFlash(0.75);
      this.shake = Math.max(this.shake, 1.1);
    }
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      target.mesh.group.visible = false;
      this.spawnImpact(point.clone().setY(2), 3.0);
      if (target.isPlayer) {
        this.endGame("lose");
      } else {
        if (attacker.isPlayer) this.kills++;
        this.pushHud();
        if (this.bots.every((b) => b.dead)) this.endGame("win");
      }
    } else {
      this.pushHud();
    }
  }

  // ---------- effects ----------
  private spawnMuzzleFlash(origin: THREE.Vector3, dir: THREE.Vector3) {
    const group = new THREE.Group();
    const flash = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.scale.setScalar(0.6);
    group.add(flash);
    const light = new THREE.PointLight(0xffb24d, 6, 18, 2);
    group.add(light);
    group.position.copy(origin);
    group.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    this.scene.add(group);

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
    this.effects.push(effect);
  }

  private spawnImpact(point: THREE.Vector3, scale: number) {
    const group = new THREE.Group();
    group.position.copy(point);

    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const flash = new THREE.Mesh(this.flashGeo, flashMat);
    flash.scale.setScalar(0.5 * scale);
    group.add(flash);

    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const smoke = new THREE.Mesh(this.flashGeo, smokeMat);
    smoke.scale.setScalar(0.4 * scale);
    group.add(smoke);

    const light = new THREE.PointLight(0xff8a3a, 4 * scale, 22 * scale, 2);
    group.add(light);

    const sparks: Spark[] = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const n = Math.round(6 + scale * 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, sparkMat);
      m.position.set(0, 0, 0);
      group.add(m);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.4,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar((4 + Math.random() * 6) * scale);
      sparks.push({ mesh: m, vel: v });
    }

    this.scene.add(group);

    const effect: Effect = {
      group, age: 0, life: 0.5 + scale * 0.12, light, sparks, grow: [flash, smoke],
      update: (dt) => {
        effect.age += dt;
        const p = clamp(effect.age / effect.life, 0, 1);
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
    this.effects.push(effect);
  }

  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      const alive = e.update(dt);
      if (!alive) {
        this.scene.remove(e.group);
        // only dispose per-effect materials; geometries are shared & reused
        e.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat.dispose();
          }
        });
        this.effects.splice(i, 1);
      }
    }
  }

  // ---------- end ----------
  private endGame(result: GameResult) {
    if (this.ended !== null) return;
    this.ended = result;
    if (document.pointerLockElement) document.exitPointerLock();
    this.cb.onEnd(result);
  }

  private damageFlash = 0;

  private triggerDamageFlash(amount: number) {
    this.damageFlash = Math.min(1, this.damageFlash + amount);
  }

  private pushHud() {
    const aliveBots = this.bots.filter((b) => !b.dead).length;
    const toDeg = (radians: number) => {
      const deg = (radians * 180) / Math.PI;
      return ((deg % 360) + 360) % 360;
    };
    const s: HudState = {
      playerHealth: Math.max(0, this.player.health),
      playerMaxHealth: this.player.spec.maxHealth,
      botsAlive: aliveBots,
      botsTotal: this.bots.length,
      kills: this.kills,
      reloadPct: 1 - this.player.reload / this.player.spec.reloadTime,
      ready: this.player.reload <= 0.001 && !this.player.dead,
      speedKmh: Math.abs(this.player.velocity) * 3.6,
      hullHeadingDeg: toDeg(this.player.hullAngle),
      turretHeadingDeg: toDeg(this.player.hullAngle + this.player.turretAngle),
      barrelPitchDeg: (this.player.barrelPitch * 180) / Math.PI,
      damageFlash: this.damageFlash,
    };
    this.damageFlash = Math.max(0, this.damageFlash - 0.06);
    this.cb.onHud(s);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    if (document.pointerLockElement) document.exitPointerLock();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
