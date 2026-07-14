import * as THREE from "three";
import type { GameSettings, GameResult, HudState } from "../types";
import { TANK_ORDER, TANK_SPECS, createTankMesh } from "./tanks";
import type { TankSpec } from "./tanks";
import type { TankMesh } from "./tank-mesh";
import { MAP_HALF, RECOIL, FIRE_RANGE } from "../constants";
import { clamp, damp, normalizeAngle, angleDiff, rotateToward, forward } from "./GameMath";
import type { Obstacle, Tank, GameCallbacks } from "./GameTypes";
import { createRenderer, disposeScene } from "../utils/three-helpers";
import { SceneBuilder } from "./scene/SceneBuilder";
import { createEffectsManager } from "./entities/Effects";
import { createShellManager } from "./entities/Shell";
import { resolveCollision, pointBlocked, lineOfSight } from "./physics/Collision";

export class TankGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private settings: GameSettings;
  private cb: GameCallbacks;
  private sceneBuilder: SceneBuilder;
  private effectsManager: ReturnType<typeof createEffectsManager>;
  private shellManager: ReturnType<typeof createShellManager>;

  private player!: Tank;
  private bots: Tank[] = [];
  private allTanks: Tank[] = [];
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
  private readonly shakeDecay = 6;
  private damageFlash = 0;

  // reusable resources
  private shellGeo!: THREE.SphereGeometry;
  private shellMat!: THREE.MeshBasicMaterial;
  private trailMat!: THREE.MeshBasicMaterial;
  private sparkGeo!: THREE.SphereGeometry;
  private flashGeo!: THREE.SphereGeometry;

  // reusable temp vectors
  private _v3a = new THREE.Vector3();
  private _v3b = new THREE.Vector3();
  private _v2a = new THREE.Vector2();
  private _v2b = new THREE.Vector2();

  private sunUpdateCounter = 0;

  constructor(canvas: HTMLCanvasElement, settings: GameSettings, cb: GameCallbacks) {
    this.settings = settings;
    this.cb = cb;

    this.renderer = createRenderer(canvas);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8ea4ae, 0.0052);

    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.camera.position.set(0, 12, 22);

    this.sceneBuilder = new SceneBuilder(this.scene, this.obstacles);
    this.initResources();
    this.effectsManager = createEffectsManager(this.scene);
    this.shellManager = createShellManager(this.scene, this.shellGeo, this.shellMat, this.trailMat);

    this.sceneBuilder.buildSky();
    this.sceneBuilder.buildLights();
    this.sceneBuilder.buildGround(this.renderer.capabilities.getMaxAnisotropy());
    this.sceneBuilder.buildObstacles();
    this.sceneBuilder.buildScenery((x, z, pad) => pointBlocked(x, z, pad, this.obstacles));
    this.spawnTanks();
    this.snapCamera();

    this.bindEvents();
    this.pushHud();
    this.cb.onAim(this.aimNdc.x, this.aimNdc.y);
  }

  private initResources() {
    this.shellGeo = new THREE.SphereGeometry(0.22, 10, 10);
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    this.trailMat = new THREE.MeshBasicMaterial({ color: 0xffae3b, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sparkGeo = new THREE.SphereGeometry(0.16, 6, 6);
    this.flashGeo = new THREE.SphereGeometry(1, 12, 12);
  }

  // ---- tank creation ----

  private makeTank(spec: TankSpec, kind: "player" | "bot"): Tank {
    const mesh = createTankMesh(spec, kind);
    return {
      spec, mesh, hullAngle: 0, turretAngle: 0, velocity: 0,
      health: spec.maxHealth, reload: 0, recoil: 0,
      isPlayer: kind === "player", dead: false,
      radius: Math.max(spec.hull.width / 2, 2.0),
      aiWander: 0, aiTimer: 0, aiTarget: null, targetTimer: 0, blocked: 0, barrelPitch: 0,
    };
  }

  private makeHpBar(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; sprite: THREE.Sprite } {
    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 18;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.8, 0.5, 1);
    sprite.position.y = 4.2;
    return { canvas, ctx, texture, sprite };
  }

  private updateHpBar(t: Tank) {
    if (!t.hpBarCanvas || !t.hpBarCtx || !t.hpBarTexture || !t.hpBarSprite) return;
    const rounded = Math.ceil(t.health);
    if (t.hpBarLastHp === rounded && !t.hpBarDirty) return;
    t.hpBarLastHp = rounded;
    t.hpBarDirty = false;
    const pct = Math.max(0, t.health / t.spec.maxHealth);
    const ctx = t.hpBarCtx;
    const w = 96, h = 18;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 3); ctx.fill();
    const color = pct > 0.5 ? "#b6d94c" : pct > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(2, 2, (w - 4) * pct, h - 4, 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${rounded}/${t.spec.maxHealth}`, w / 2, h / 2 + 0.5);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 3); ctx.stroke();
    t.hpBarTexture.needsUpdate = true;
  }

  private spawnTanks() {
    const playerSpec = TANK_SPECS[this.settings.tankModel];
    const player = this.makeTank(playerSpec, "player");
    player.mesh.group.position.set(0, 0, 0);
    player.hullAngle = Math.PI;
    this.scene.add(player.mesh.group);
    this.player = player;

    const count = clamp(this.settings.botCount, 1, 12);
    for (let i = 0; i < count; i++) {
      const model = TANK_ORDER[i % TANK_ORDER.length];
      const spec = TANK_SPECS[model];
      const bot = this.makeTank(spec, "bot");
      const pos = this.findSpawn();
      bot.mesh.group.position.set(pos.x, 0, pos.y);
      bot.hullAngle = Math.atan2(-pos.x, -pos.y);
      this.scene.add(bot.mesh.group);
      const bar = this.makeHpBar();
      bot.hpBarCanvas = bar.canvas;
      bot.hpBarCtx = bar.ctx;
      bot.hpBarTexture = bar.texture;
      bot.hpBarSprite = bar.sprite;
      bot.mesh.group.add(bar.sprite);
      this.updateHpBar(bot);
      this.bots.push(bot);
    }
    this.allTanks = [this.player, ...this.bots];
  }

  private findSpawn(): THREE.Vector2 {
    for (let i = 0; i < 60; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * (MAP_HALF - 36);
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      if (pointBlocked(x, z, 3, this.obstacles)) continue;
      return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(30, 30);
  }

  // ---- events ----

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
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    if (!this.locked) this.keys = {};
    const wantPause = !this.locked && this.ended === null;
    if (wantPause !== this.paused) { this.paused = wantPause; this.cb.onPause(this.paused); }
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
    if (!this.locked) { this.lockPointer(); return; }
    this.firePlayer();
  };

  private lockPointer() {
    const el = this.renderer.domElement;
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.then === "function") p.catch(() => {});
  }

  requestLock() { this.lockPointer(); }

  // ---- loop ----

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
      this.shellManager.updateShells(dt, this.allTanks, this.obstacles,
        (t) => this.tankAimHeight(t),
        (target, dmg, point, attacker) => this.hitTank(target, dmg, point, attacker),
        (point) => this.effectsManager.spawnImpact(point, 0.9, this.flashGeo, this.sparkGeo));
      this.effectsManager.updateEffects(dt);
      this.applyRecoil(dt);
    }
    this.updateCamera();
    this.updateSun();

    for (const b of this.bots) this.updateHpBar(b);

    this.hudAccum += dt;
    if (this.hudAccum > 0.1) { this.hudAccum = 0; this.pushHud(); }
  }

  // ---- player ----

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.dead) return;
    p.reload = Math.max(0, p.reload - dt);

    const accel = (this.keys["KeyW"] || this.keys["ArrowUp"] ? 1 : 0) - (this.keys["KeyS"] || this.keys["ArrowDown"] ? 1 : 0);
    const turnDir = accel < 0 ? -1 : 1;
    const turn = turnDir * ((this.keys["KeyA"] || this.keys["ArrowLeft"] ? 1 : 0) - (this.keys["KeyD"] || this.keys["ArrowRight"] ? 1 : 0));
    p.hullAngle += turn * p.spec.rotSpeed * dt;
    p.velocity = damp(p.velocity, accel * p.spec.maxSpeed, 6, dt);
    this.moveTank(p, dt);

    const edgeX = Math.max(0, Math.abs(this.aimNdc.x) - 0.55);
    const edgeY = Math.max(0, Math.abs(this.aimNdc.y) - 0.42);
    this.yaw -= Math.sign(this.aimNdc.x) * edgeX * 2.2 * dt;
    this.pitch = clamp(this.pitch - Math.sign(this.aimNdc.y) * edgeY * 1.35 * dt, -0.16, 0.34);

    const aimDir = this.getAimDirection();
    p.turretAngle = Math.atan2(aimDir.x, aimDir.z) - p.hullAngle;
    p.barrelPitch = clamp(-Math.asin(clamp(aimDir.y, -1, 1)), -0.42, 0.32);
    this.syncTank(p);

    if (this.keys["Space"]) this.firePlayer();
  }

  // ---- bot AI ----

  private updateBot(b: Tank, dt: number) {
    if (b.dead) return;
    b.reload = Math.max(0, b.reload - dt);
    b.targetTimer -= dt;
    if (b.targetTimer <= 0 || !b.aiTarget || b.aiTarget.dead) {
      b.aiTarget = this.findNearestTarget(b);
      b.targetTimer = 0.8 + Math.random() * 0.8;
    }
    const target = b.aiTarget;
    if (!target) { b.velocity = damp(b.velocity, 0, 5, dt); return; }

    const pp = target.mesh.group.position;
    const bp = b.mesh.group.position;
    const dx = pp.x - bp.x, dz = pp.z - bp.z;
    const dist = Math.hypot(dx, dz);
    const desiredHull = Math.atan2(dx, dz);

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) { b.aiTimer = 1.2 + Math.random() * 2.2; b.aiWander = (Math.random() - 0.5) * (b.blocked > 0 ? 1.6 : 0.5); }

    const desiredTurret = Math.atan2(dx, dz);
    b.turretAngle = desiredTurret - b.hullAngle;
    b.barrelPitch = clamp(-Math.atan2(this.tankAimHeight(target) - this.tankAimHeight(b), Math.max(1, dist)), -0.42, 0.32);

    const engage = 26;
    let speed = 0;
    if (dist > engage) speed = b.spec.maxSpeed * 0.85;
    else if (dist < engage * 0.55) speed = -b.spec.maxSpeed * 0.4;
    if (b.blocked > 0.05) speed = b.spec.maxSpeed * 0.6;

    b.velocity = damp(b.velocity, speed, 4, dt);
    b.hullAngle = rotateToward(b.hullAngle, desiredHull + b.aiWander, b.spec.rotSpeed * dt);
    this.moveTank(b, dt);
    this.syncTank(b);

    const worldTurret = b.hullAngle + b.turretAngle;
    const facingErr = Math.abs(angleDiff(worldTurret, desiredTurret));
    const canSee = dist < FIRE_RANGE && lineOfSight(bp.x, bp.z, pp.x, pp.z, this.obstacles);
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
      const score = distance * (0.88 + Math.random() * 0.24);
      if (score < bestScore) { bestScore = score; chosen = candidate; }
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
    resolveCollision(before, t.radius, this.obstacles);
    const moved = Math.hypot(before.x - nx, before.y - nz);
    t.blocked = damp(t.blocked, moved > 0.001 && t.velocity > 0.1 && moved > 0.2 ? 1 : 0, moved > 0.001 && t.velocity > 0.1 ? 8 : 4, dt);
    pos.x = before.x;
    pos.z = before.y;

    for (const o of this.allTanks) {
      if (o === t || o.dead) continue;
      const op = o.mesh.group.position;
      const ddx = pos.x - op.x, ddz = pos.z - op.z;
      const dd = Math.hypot(ddx, ddz);
      const min = t.radius + o.radius;
      if (dd > 0.0001 && dd < min) {
        const push = (min - dd) / 2;
        pos.x += (ddx / dd) * push;
        pos.z += (ddz / dd) * push;
      }
    }
  }

  // ---- camera ----

  private getAimDirection(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.aimNdc, this.camera);
    return this.raycaster.ray.direction.clone().normalize();
  }

  private snapCamera() {
    const p = this.player.mesh.group.position;
    this.camera.position.set(p.x + Math.sin(this.yaw) * 16, p.y + 8.7, p.z + Math.cos(this.yaw) * 16);
    this.lookCameraForward();
  }

  private updateCamera() {
    const p = this.player.mesh.group.position;
    const desired = new THREE.Vector3(p.x + Math.sin(this.yaw) * 16, p.y + 8.7, p.z + Math.cos(this.yaw) * 16);
    this.camera.position.lerp(desired, this.paused ? 0 : 0.4);
    const speedFactor = Math.min(0.06, this.player.velocity / 220);
    this.camera.fov = this.baseFov + speedFactor * 10;
    this.camera.updateProjectionMatrix();
    this.lookCameraForward();
  }

  private lookCameraForward() {
    const cp = Math.cos(this.pitch);
    const dir = this._v3a.set(-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    if (this.shake > 0.001) {
      dir.x += (Math.random() - 0.5) * this.shake * 0.05;
      dir.y += (Math.random() - 0.5) * this.shake * 0.04;
      dir.z += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake = Math.max(0, this.shake - this.shakeDecay * 0.016);
    }
    this._v3b.copy(this.camera.position).addScaledVector(dir, 50);
    this.camera.lookAt(this._v3b);
  }

  private updateSun() {
    this.sunUpdateCounter++;
    if (this.sunUpdateCounter % 10 !== 0) return;
    const p = this.player.mesh.group.position;
    this.sceneBuilder.sun.position.set(p.x + 60, 95, p.z + 40);
    this.sceneBuilder.sun.target.position.set(p.x, 0, p.z);
    this.sceneBuilder.sun.target.updateMatrixWorld();
  }

  // ---- firing ----

  private applyRecoil(dt: number) {
    for (const t of this.allTanks) {
      if (t.dead) continue;
      t.recoil = damp(t.recoil, 0, 14, dt);
      t.mesh.barrel.position.z = -t.recoil;
    }
  }

  private computeAimPoint(): THREE.Vector3 {
    this.raycaster.setFromCamera(this.aimNdc, this.camera);
    const targets: THREE.Object3D[] = [this.sceneBuilder.ground];
    for (const o of this.obstacles) targets.push(o.mesh);
    for (const b of this.bots) if (!b.dead) targets.push(b.mesh.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length) return hits[0].point.clone();
    return this.raycaster.ray.at(FIRE_RANGE, new THREE.Vector3());
  }

  private firePlayer() { this.fireTank(this.player); }

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
      const ang = (Math.random() - 0.5) * 0.06;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      dir = new THREE.Vector3(dir.x * ca - dir.z * sa, dir.y + (Math.random() - 0.5) * 0.018, dir.x * sa + dir.z * ca).normalize();
    }
    const vel = dir.clone().multiplyScalar(t.spec.shellSpeed);
    this.shellManager.spawnShell(muzzleWorld, vel, t, t.spec.damage);
    this.effectsManager.spawnMuzzleFlash(muzzleWorld, dir, this.flashGeo);
    this.shake = Math.max(this.shake, t.isPlayer ? 0.55 : 0.3);
  }

  private hitTank(target: Tank, damage: number, point: THREE.Vector3, attacker: Tank) {
    target.health -= damage;
    target.hpBarDirty = true;
    this.effectsManager.spawnImpact(point, 1.4, this.flashGeo, this.sparkGeo);
    if (target.isPlayer) { this.damageFlash = Math.min(1, this.damageFlash + 0.75); this.shake = Math.max(this.shake, 1.1); }
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      target.mesh.group.visible = false;
      this.effectsManager.spawnImpact(point.clone().setY(2), 3.0, this.flashGeo, this.sparkGeo);
      if (target.isPlayer) this.endGame("lose");
      else { if (attacker.isPlayer) this.kills++; this.pushHud(); if (this.bots.every((b) => b.dead)) this.endGame("win"); }
    } else { this.pushHud(); }
  }

  // ---- end ----

  private endGame(result: GameResult) {
    if (this.ended !== null) return;
    this.ended = result;
    if (document.pointerLockElement) document.exitPointerLock();
    this.cb.onEnd(result);
  }

  private targetCache: THREE.Object3D[] = [];

  private getTarget(): Tank | null {
    this.raycaster.setFromCamera(this.aimNdc, this.camera);
    this.targetCache.length = 0;
    for (const b of this.bots) if (!b.dead) this.targetCache.push(b.mesh.group);
    const hits = this.raycaster.intersectObjects(this.targetCache, true);
    if (!hits.length) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      for (const b of this.bots) { if (!b.dead && obj === b.mesh.group) return b; }
      obj = obj.parent;
    }
    return null;
  }

  private pushHud() {
    let aliveBots = 0;
    for (const b of this.bots) if (!b.dead) aliveBots++;
    const toDeg = (radians: number) => ((radians * 180) / Math.PI % 360 + 360) % 360;
    const target = this.getTarget();
    const s: HudState = {
      playerHealth: Math.max(0, this.player.health),
      playerMaxHealth: this.player.spec.maxHealth,
      botsAlive: aliveBots, botsTotal: this.bots.length, kills: this.kills,
      reloadPct: 1 - this.player.reload / this.player.spec.reloadTime,
      ready: this.player.reload <= 0.001 && !this.player.dead,
      speedKmh: Math.abs(this.player.velocity) * 3.6,
      hullHeadingDeg: toDeg(this.player.hullAngle),
      turretHeadingDeg: toDeg(this.player.hullAngle + this.player.turretAngle),
      barrelPitchDeg: (this.player.barrelPitch * 180) / Math.PI,
      damageFlash: this.damageFlash,
      targetName: target ? target.spec.name : "",
      targetHealth: target ? Math.max(0, target.health) : 0,
      targetMaxHealth: target ? target.spec.maxHealth : 0,
    };
    this.damageFlash = Math.max(0, this.damageFlash - 0.06);
    this.cb.onHud(s);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    if (document.pointerLockElement) document.exitPointerLock();
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}
