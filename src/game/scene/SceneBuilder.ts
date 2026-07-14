import * as THREE from "three";
import { MAP_HALF } from "../../constants";
import { addBox as addWorldBox } from "../../utils/three-helpers";
import type { Obstacle } from "../GameTypes";


export class SceneBuilder {
  private scene: THREE.Scene;
  private obstacles: Obstacle[];
  ground!: THREE.Mesh;
  sun!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, obstacles: Obstacle[]) {
    this.scene = scene;
    this.obstacles = obstacles;
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x18324f) },
        mid: { value: new THREE.Color(0x7896aa) },
        bot: { value: new THREE.Color(0xd4c4a5) },
        sunDir: { value: new THREE.Vector3(0.45, 0.68, 0.34).normalize() },
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
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

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xbdd8ee, 0x343326, 1.15));
    const sun = new THREE.DirectionalLight(0xffe2b3, 2.55);
    sun.position.set(60, 95, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    const s = 95;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  buildGround(maxAnisotropy: number) {
    const tex = this.makeGroundTexture(maxAnisotropy);
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2 + 40, MAP_HALF * 2 + 40);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

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
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      this.obstacles.push({ box: new THREE.Box3().setFromObject(m), mesh: m });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.16, d + 0.16), wallCapMat);
      cap.position.set(x, y + h + 0.08, z);
      cap.castShadow = true;
      this.scene.add(cap);
    }
    this.buildRoads();
  }

  private makeGroundTexture(maxAnisotropy: number): THREE.Texture {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4a5134";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4600; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = Math.random() * 16 + 1;
      const g = Math.random() > 0.5 ? 78 + Math.random() * 36 : 45 + Math.random() * 24;
      ctx.fillStyle = `rgba(${42 + Math.random() * 34},${g},${28 + Math.random() * 22},${0.2 + Math.random() * 0.34})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * size, y = Math.random() * size, length = 3 + Math.random() * 10;
      ctx.strokeStyle = `rgba(205,190,145,${0.06 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + (Math.random() - 0.5) * 5); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(10, 10);
    tex.anisotropy = Math.min(8, maxAnisotropy);
    return tex;
  }

  private buildRoads() {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#766547"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 900; i++) {
      const shade = 70 + Math.random() * 75;
      ctx.fillStyle = `rgba(${shade},${shade * 0.84},${shade * 0.58},${0.08 + Math.random() * 0.2})`;
      ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 512, 1 + Math.random() * 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(38,34,27,0.25)"; ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(55, 0); ctx.lineTo(55, 512); ctx.moveTo(201, 0); ctx.lineTo(201, 512); ctx.stroke();
    const roadTexture = new THREE.CanvasTexture(canvas);
    roadTexture.colorSpace = THREE.SRGBColorSpace;
    roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 7);
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 1, transparent: true, opacity: 0.82, depthWrite: false });
    const routes: [number, number, number, number][] = [
      [7.5, 170, -16, 0.1], [6.5, 145, 27, Math.PI / 2.8], [5.5, 110, -35, -Math.PI / 3.8],
    ];
    for (const [width, length, offset, angle] of routes) {
      const roadGeo = new THREE.PlaneGeometry(width, length, 1, 1);
      roadGeo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.position.set(angle === 0.1 ? offset : 0, 0.018, angle === 0.1 ? 0 : offset);
      road.rotation.y = angle; road.receiveShadow = true;
      this.scene.add(road);
    }
  }

  buildObstacles() {
    const placeObstacle = (mesh: THREE.Object3D, x: number, z: number) => {
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      this.obstacles.push({ box, mesh });
    };

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x777772, roughness: 0.92 });
    const concreteDark = new THREE.MeshStandardMaterial({ color: 0x4a4b49, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x292d30, roughness: 0.72, metalness: 0.25 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x172028, roughness: 0.2, metalness: 0.65, emissive: 0x111923, emissiveIntensity: 0.28 });
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
      crates.userData.type = "crate";
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

    let attempts = 0, placed = 0;
    while (placed < 22 && attempts < 500) {
      attempts++;
      const x = rand(-MAP_HALF + 8, MAP_HALF - 8);
      const z = rand(-MAP_HALF + 8, MAP_HALF - 8);
      if (!isFarFromCenter(x, z)) continue;
      let ok = true;
      for (const o of this.obstacles) {
        if (Math.abs(x - (o.box.min.x + o.box.max.x) / 2) < 10 && Math.abs(z - (o.box.min.z + o.box.max.z) / 2) < 10) { ok = false; break; }
      }
      if (!ok) continue;
      const kind = Math.random();
      let obstacle: THREE.Object3D;
      if (kind < 0.42) obstacle = makeBuilding(rand(5.5, 9), rand(5.5, 9), rand(4.5, 9.5));
      else if (kind < 0.62) obstacle = makeBarrier();
      else if (kind < 0.82) obstacle = makeCrates();
      else obstacle = makeRocks();
      obstacle.rotation.y = Math.round(Math.random() * 3) * (Math.PI / 2) + rand(-0.08, 0.08);
      obstacle.traverse((object) => { const m = object as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      placeObstacle(obstacle, x, z);
      placed++;
    }
  }

  buildScenery(pointBlocked: (x: number, z: number, pad: number) => boolean) {
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
      if (Math.hypot(x, z) < 8 || pointBlocked(x, z, 0.5)) continue;
      const scale = rand(0.55, 1.45);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rand(0, Math.PI), rand(-0.15, 0.15));
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      grass.setMatrixAt(grassIndex++, dummy.matrix);
    }
    grass.castShadow = true; grass.receiveShadow = true;
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
      const scale = rand(0.75, 1.35);
      dummy.position.set(Math.cos(angle) * radius, 1.9 * scale, Math.sin(angle) * radius);
      dummy.rotation.set(0, rand(0, Math.PI), 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 5.1 * scale;
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.castShadow = true; crowns.castShadow = true;
    this.scene.add(trunks, crowns);

    const craterMat = new THREE.MeshStandardMaterial({ color: 0x302d25, roughness: 1 });
    for (let i = 0; i < 13; i++) {
      const x = rand(-MAP_HALF + 10, MAP_HALF - 10);
      const z = rand(-MAP_HALF + 10, MAP_HALF - 10);
      if (pointBlocked(x, z, 2)) continue;
      const crater = new THREE.Mesh(new THREE.TorusGeometry(rand(0.8, 1.7), 0.16, 7, 18), craterMat);
      crater.rotation.x = Math.PI / 2; crater.scale.y = rand(0.72, 1.15);
      crater.position.set(x, 0.045, z); crater.receiveShadow = true;
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
}
