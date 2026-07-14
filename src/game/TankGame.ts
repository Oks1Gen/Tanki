import * as THREE from "three";
import type { GameSettings, GameResult, HudState, AmmoType, AmmoState, CamoType } from "../types";
import { TANK_ORDER, TANK_SPECS, createTankMesh } from "./tanks";
import type { TankSpec } from "./tanks";
import { MAP_HALF, RECOIL, FIRE_RANGE } from "../constants";
import { clamp, damp, angleDiff, rotateToward, forward } from "./GameMath";
import { computeUpgradeEffects, CAMO_COLORS } from "../data/upgrades";
import type { Obstacle, Tank, GameCallbacks } from "./GameTypes";
import { createRenderer, disposeScene } from "../utils/three-helpers";
import { SceneBuilder } from "./scene/SceneBuilder";
import { createEffectsManager } from "./entities/Effects";
import { createShellManager } from "./entities/Shell";
import { createPickupManager } from "./entities/Pickups";
import { createDestructibleManager } from "./entities/Destructibles";
import { resolveCollision, pointBlocked, lineOfSight } from "./physics/Collision";

export class TankGame {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  private raf = 0;
  private disposed = false;

  private settings: GameSettings;
  private cb: GameCallbacks;
  private sceneBuilder: SceneBuilder;
  private effectsManager: ReturnType<typeof createEffectsManager>;
  private shellManager: ReturnType<typeof createShellManager>;
  private pickupManager: ReturnType<typeof createPickupManager>;
  private destructibleManager: ReturnType<typeof createDestructibleManager>;

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
  private statsDamage = 0;
  private statsShotsFired = 0;
  private statsShotsHit = 0;
  private craterMat = new THREE.MeshStandardMaterial({ color: 0x3d3528, roughness: 1 });
  private craters: THREE.Mesh[] = [];
  private readonly MAX_CRATERS = 40;

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
    this.pickupManager = createPickupManager(this.scene, (x, z, pad) => pointBlocked(x, z, pad, this.obstacles));
    this.destructibleManager = createDestructibleManager();

    this.sceneBuilder.buildSky();
    this.sceneBuilder.buildLights();
    this.sceneBuilder.buildGround(this.renderer.capabilities.getMaxAnisotropy());
    this.sceneBuilder.buildObstacles();
    this.sceneBuilder.buildScenery((x, z, pad) => pointBlocked(x, z, pad, this.obstacles));
    this.spawnTanks();
    this.pickupManager.init();
    this.markDestructibles();
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

  private makeTank(spec: TankSpec, kind: "player" | "bot", bodyColor?: number, camoType?: CamoType): Tank {
    const mesh = createTankMesh(spec, kind, bodyColor, camoType);
    const ammo: AmmoState = { ap: 18, heat: 10, he: 8, current: "ap" };
    return {
      spec, mesh, hullAngle: 0, turretAngle: 0, velocity: 0,
      health: spec.maxHealth, reload: 0, recoil: 0,
      isPlayer: kind === "player", dead: false,
      radius: Math.max(spec.hull.width / 2, 2.0),
      aiWander: 0, aiTimer: 0, aiTarget: null, targetTimer: 0, blocked: 0, barrelPitch: 0,
      modules: { trackLeft: 100, trackRight: 100, gun: 100, engine: 100 },
      ammo, speedBoost: 1, damageBoost: 1,
      trackLeftTimer: 0, trackRightTimer: 0, trackLeftHits: 0, trackRightHits: 0,
      magazineAmmo: spec.magazineSize, magazineSize: spec.magazineSize,
      reloadMul: 1, damageMul: 1, speedMul: 1, turretRotMul: 1, hullRotMul: 1,
    };
  }

  private makeHpBar(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; sprite: THREE.Sprite } {
    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 24;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.8, 0.65, 1);
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
    const w = 96, h = 24;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 3); ctx.fill();
    const color = pct > 0.5 ? "#b6d94c" : pct > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(2, 2, (w - 4) * pct, 16, 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${rounded}`, w / 2, 9.5);

    const lTimer = Math.max(0, t.trackLeftTimer);
    const rTimer = Math.max(0, t.trackRightTimer);
    if (lTimer > 0 || rTimer > 0) {
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.fillText(`⬡${lTimer > 0 ? lTimer.toFixed(1) : "0"}|${rTimer > 0 ? rTimer.toFixed(1) : "0"}`, w / 2, 21);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 3); ctx.stroke();
    t.hpBarTexture.needsUpdate = true;
  }

  private applyUpgrades() {
    const p = this.player;
    const up = this.settings.upgrades;
    const ef = computeUpgradeEffects(up, this.settings.goldUpgrades, this.settings.tankModel);
    p.damageMul = ef.damageMul;
    p.speedMul = ef.speedMul;
    p.turretRotMul = ef.turretRotMul;
    p.hullRotMul = ef.hullRotMul;
    p.health = Math.round(p.spec.maxHealth * ef.healthMul);
    p.spec = { ...p.spec, maxHealth: Math.round(p.spec.maxHealth * ef.healthMul) };
    const capMul = ef.ammoCapacity;
    p.ammo.ap = Math.round(18 * capMul);
    p.ammo.heat = Math.round(10 * capMul);
    p.ammo.he = Math.round(8 * capMul);
    if (ef.magazineSize) { p.magazineAmmo = ef.magazineSize; p.magazineSize = ef.magazineSize; p.reloadMul = ef.reloadMul || 1; }
  }

  private spawnTanks() {
    const playerSpec = TANK_SPECS[this.settings.tankModel];
    const playerCamoColor = this.settings.camo ? (CAMO_COLORS[this.settings.camo] || undefined) : undefined;
    const player = this.makeTank(playerSpec, "player", playerCamoColor, this.settings.camo);
    player.mesh.group.position.set(0, 0, 0);
    player.hullAngle = Math.PI;
    this.scene.add(player.mesh.group);
    this.player = player;
    this.applyUpgrades();

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
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.timer.getDelta();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.timer.getDelta(), 0.05);
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
        (target, dmg, point, attacker, type) => this.hitTank(target, dmg, point, attacker, type),
        (point, type) => {
          this.effectsManager.spawnImpact(point, type === "he" ? 1.2 : 0.9, this.flashGeo, this.sparkGeo);
          this.addCrater(point);
          for (const o of this.obstacles) {
            if (o.destructible && o.hp !== undefined && o.hp > 0 && o.box.containsPoint(point)) {
              this.destructibleManager.damage(o, Math.round(30 * (type === "he" ? 1.5 : 1)), (ob) => {
                ob.mesh.visible = false;
                ob.box.min.set(0, 0, 0);
                ob.box.max.set(0, 0, 0);
                this.effectsManager.spawnImpact(point, 1.5, this.flashGeo, this.sparkGeo);
              });
              break;
            }
          }
        });
      this.effectsManager.updateEffects(dt);
      this.applyRecoil(dt);
      this.pickupManager.update(dt,
        this.allTanks.filter((t) => !t.dead).map((t) => ({ x: t.mesh.group.position.x, z: t.mesh.group.position.z })),
        (type) => this.onPickup(type));
    }
    this.updateCamera();
    this.updateSun();

    for (const b of this.bots) this.updateHpBar(b);

    this.hudAccum += dt;
    if (this.hudAccum > 0.1) { this.hudAccum = 0; this.pushHud(); }
  }

  // ---- player ----

  private pickupAlert = "";
  private pickupAlertTimer = 0;

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.dead) return;
    p.reload = Math.max(0, p.reload - dt);
    if (p.reload <= 0 && p.magazineAmmo <= 0) p.magazineAmmo = p.magazineSize;
    p.speedBoost = damp(p.speedBoost, 1, 0.5, dt);
    p.damageBoost = damp(p.damageBoost, 1, 0.5, dt);
    if (p.trackLeftTimer > 0) p.trackLeftTimer -= dt;
    if (p.trackRightTimer > 0) p.trackRightTimer -= dt;

    const tracked = p.trackLeftTimer > 0 || p.trackRightTimer > 0;
    const engineMul = p.modules.engine <= 0 ? 0.35 : 1;

    const accel = (this.keys["KeyW"] || this.keys["ArrowUp"] ? 1 : 0) - (this.keys["KeyS"] || this.keys["ArrowDown"] ? 1 : 0);
    const turnDir = accel < 0 ? -1 : 1;
    const turnBase = (this.keys["KeyA"] || this.keys["ArrowLeft"] ? 1 : 0) - (this.keys["KeyD"] || this.keys["ArrowRight"] ? 1 : 0);
    const turn = turnDir * turnBase;
    p.hullAngle += turn * p.spec.rotSpeed * p.hullRotMul * dt * (tracked ? 0.3 : 1);
    const maxSpd = p.spec.maxSpeed * p.speedMul * p.speedBoost * engineMul;
    p.velocity = damp(p.velocity, accel * maxSpd, 6, dt);
    this.moveTank(p, dt);

    if (this.keys["KeyQ"]) { this.keys["KeyQ"] = false; this.switchAmmo(-1); }
    if (this.keys["KeyE"]) { this.keys["KeyE"] = false; this.switchAmmo(1); }

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

  private switchAmmo(dir: number) {
    const order: AmmoType[] = ["ap", "heat", "he"];
    const idx = order.indexOf(this.player.ammo.current);
    this.player.ammo.current = order[((idx + dir) % 3 + 3) % 3];
  }

  private onPickup(type: string) {
    const p = this.player;
    const labels: Record<string, string> = { repair: "Ремонт +400 HP", speed: "Ускорение x1.5", damage: "Дамаг-буст x1.5", ammo: "+10 снарядов" };
    this.pickupAlert = labels[type] || "";
    this.pickupAlertTimer = 2;
    if (type === "repair") { p.health = Math.min(p.health + 400, p.spec.maxHealth); p.hpBarDirty = true; }
    else if (type === "speed") p.speedBoost = 1.5;
    else if (type === "damage") p.damageBoost = 1.5;
    else if (type === "ammo") { p.ammo.ap = Math.min(p.ammo.ap + 10, 50); p.ammo.heat = Math.min(p.ammo.heat + 10, 30); p.ammo.he = Math.min(p.ammo.he + 10, 24); }
  }

  private markDestructibles() {
    for (const o of this.obstacles) {
      if (o.mesh.userData.type === "crate") this.destructibleManager.markDestructible(o, 40);
    }
  }

  // ---- bot AI ----

  private findCoverSpot(seeker: Tank, from: Tank): THREE.Vector3 | null {
    const sp = seeker.mesh.group.position;
    let best: THREE.Vector3 | null = null;
    let bestDist = -1;
    for (const o of this.obstacles) {
      if (o.mesh.userData.type === "crate") continue;
      const center = this._v3a.copy(o.box.min).add(o.box.max).multiplyScalar(0.5);
      const dx = center.x - sp.x, dz = center.z - sp.z;
      const d = Math.hypot(dx, dz);
      if (d < 6 || d > 30) continue;
      const behindX = center.x + (center.x - from.mesh.group.position.x) * 0.5;
      const behindZ = center.z + (center.z - from.mesh.group.position.z) * 0.5;
      const candidate = this._v3b.set(behindX, 0, behindZ);
      const toCandidate = Math.hypot(candidate.x - sp.x, candidate.z - sp.z);
      if (toCandidate > 35) continue;
      if (lineOfSight(sp.x, sp.z, candidate.x, candidate.z, this.obstacles)) continue;
      if (toCandidate > bestDist) { bestDist = toCandidate; best = candidate.clone(); }
    }
    return best;
  }

  private updateBot(b: Tank, dt: number) {
    if (b.dead) return;
    b.reload = Math.max(0, b.reload - dt);
    if (b.reload <= 0 && b.magazineAmmo <= 0) b.magazineAmmo = b.magazineSize;
    if (b.trackLeftTimer > 0) { b.trackLeftTimer -= dt; b.hpBarDirty = true; }
    if (b.trackRightTimer > 0) { b.trackRightTimer -= dt; b.hpBarDirty = true; }
    b.targetTimer -= dt;
    if (b.targetTimer <= 0 || !b.aiTarget || b.aiTarget.dead) {
      b.aiTarget = this.findNearestTarget(b);
      b.targetTimer = 0.8 + Math.random() * 0.8;
    }
    const target = b.aiTarget;
    if (!target) { b.velocity = damp(b.velocity, 0, 5, dt); return; }

    const isReloading = b.reload > 0.5;
    const tracked = b.trackLeftTimer > 0 || b.trackRightTimer > 0;

    let moveTo: THREE.Vector3 | null = null;
    if (isReloading && !tracked) {
      moveTo = this.findCoverSpot(b, target);
    }

    const bp = b.mesh.group.position;
    const pp = moveTo || target.mesh.group.position;
    const dx = pp.x - bp.x, dz = pp.z - bp.z;
    const dist = Math.hypot(dx, dz);
    const desiredHull = Math.atan2(dx, dz);

    b.aiTimer -= dt;
    if (b.aiTimer <= 0) { b.aiTimer = 1.2 + Math.random() * 2.2; b.aiWander = (Math.random() - 0.5) * (b.blocked > 0 ? 1.6 : 0.5); }

    const desiredTurret = Math.atan2(target.mesh.group.position.x - bp.x, target.mesh.group.position.z - bp.z);
    b.turretAngle = desiredTurret - b.hullAngle;
    b.barrelPitch = clamp(-Math.atan2(this.tankAimHeight(target) - this.tankAimHeight(b), Math.max(1, dist)), -0.42, 0.32);

    const engage = 26;
    let speed = 0;
    if (tracked) speed = 0;
    else if (moveTo) speed = b.spec.maxSpeed * 0.7;
    else if (dist > engage) speed = b.spec.maxSpeed * 0.85;
    else if (dist < engage * 0.55) speed = -b.spec.maxSpeed * 0.4;
    if (b.blocked > 0.05) speed = b.spec.maxSpeed * 0.6;

    b.velocity = damp(b.velocity, speed, 4, dt);
    b.hullAngle = rotateToward(b.hullAngle, desiredHull + b.aiWander, b.spec.rotSpeed * dt * (tracked ? 0.3 : 1));
    this.moveTank(b, dt);
    this.syncTank(b);

    const worldTurret = b.hullAngle + b.turretAngle;
    const facingErr = Math.abs(angleDiff(worldTurret, Math.atan2(target.mesh.group.position.x - bp.x, target.mesh.group.position.z - bp.z)));
    const canSee = dist < FIRE_RANGE && lineOfSight(bp.x, bp.z, target.mesh.group.position.x, target.mesh.group.position.z, this.obstacles);
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
      let score = distance;

      const buddies = this.bots.filter((o) => o !== seeker && !o.dead && o.aiTarget === candidate);
      score += buddies.length * 12;

      score *= 0.88 + Math.random() * 0.24;
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

  private ammoDamage(type: AmmoType): number { return type === "ap" ? 1 : type === "heat" ? 0.8 : 0.6; }

  private getAmmoType(t: Tank): AmmoType {
    if (!t.isPlayer) return ["ap", "heat", "he"][Math.floor(Math.random() * 3)] as AmmoType;
    const valid: AmmoType[] = ["ap", "heat", "he"];
    return valid.includes(t.ammo.current) ? t.ammo.current : "ap";
  }

  private fireTank(t: Tank, target?: Tank) {
    if (t.dead || t.reload > 0) return;
    if (t.modules.gun <= 0) return;
    if (t.magazineAmmo <= 0) return;
    if (!t.isPlayer && (!target || target.dead)) return;
    const type = this.getAmmoType(t);
    if (t.isPlayer) {
      if (t.ammo[type] <= 0) { this.pickupAlert = "Нет снарядов!"; return; }
      t.ammo[type]--;
    }
    t.magazineAmmo--;
    if (t.magazineAmmo > 0) t.reload = 0.3;
    else t.reload = t.spec.reloadTime * t.reloadMul;
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
    const dmgMult = this.ammoDamage(type) * t.damageBoost * t.damageMul;
    this.shellManager.spawnShell(muzzleWorld, vel, t, Math.round(t.spec.damage * dmgMult), type);
    this.effectsManager.spawnMuzzleFlash(muzzleWorld, dir, this.flashGeo);
    this.spawnBarrelSmoke(t);
    if (t.isPlayer) this.statsShotsFired++;
    this.shake = Math.max(this.shake, t.isPlayer ? 0.55 : 0.3);
  }

  private damageModule(target: Tank) {
    const roll = Math.random();
    if (roll < 0.55) {
      const side = Math.random() < 0.5 ? "trackLeft" : "trackRight";
      if (side === "trackLeft") {
        if (target.trackLeftTimer <= 0) target.trackLeftHits++;
        if (target.trackLeftHits >= 2) { target.trackLeftTimer = 3.5; target.trackLeftHits = 0; target.hpBarDirty = true; }
      } else {
        if (target.trackRightTimer <= 0) target.trackRightHits++;
        if (target.trackRightHits >= 2) { target.trackRightTimer = 3.5; target.trackRightHits = 0; target.hpBarDirty = true; }
      }
    } else if (roll < 0.78) target.modules.gun = Math.max(0, target.modules.gun - 30);
    else target.modules.engine = Math.max(0, target.modules.engine - 25);
  }

  private addCrater(point: THREE.Vector3) {
    if (this.craters.length >= this.MAX_CRATERS) {
      const old = this.craters.shift()!;
      this.scene.remove(old);
    }
    const crater = new THREE.Mesh(new THREE.TorusGeometry(0.4 + Math.random() * 0.7, 0.08 + Math.random() * 0.08, 6, 12), this.craterMat);
    crater.rotation.x = Math.PI / 2;
    crater.scale.y = 0.6 + Math.random() * 0.4;
    crater.position.set(point.x, 0.015, point.z);
    crater.receiveShadow = true;
    this.scene.add(crater);
    this.craters.push(crater);
  }

  private spawnBarrelSmoke(t: Tank) {
    const muzzleWorld = new THREE.Vector3();
    t.mesh.muzzle.getWorldPosition(muzzleWorld);
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    smoke.position.copy(muzzleWorld);
    this.scene.add(smoke);
    const start = Date.now();
    const anim = () => {
      if (this.disposed) return;
      const t = (Date.now() - start) / 1000;
      const p = Math.min(t / 1.2, 1);
      smoke.position.y += 0.008;
      smoke.scale.setScalar(0.5 + p * 2);
      (smoke.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - p);
      if (p < 1) requestAnimationFrame(anim);
      else { smoke.geometry.dispose(); (smoke.material as THREE.MeshBasicMaterial).dispose(); this.scene.remove(smoke); }
    };
    anim();
  }

  private hitTank(target: Tank, damage: number, point: THREE.Vector3, attacker: Tank, type: AmmoType) {
    const moduleDmg = type === "he" ? 1.8 : type === "heat" ? 1.2 : 0.7;
    if (Math.random() < 0.5 * moduleDmg) this.damageModule(target);
    const trackBroken = target.trackLeftTimer > 0 || target.trackRightTimer > 0;
    target.health -= damage;
    target.hpBarDirty = true;
    if (attacker.isPlayer) { this.statsShotsHit++; this.statsDamage += damage; }
    this.effectsManager.spawnImpact(point, 1.4 * (type === "he" ? 1.5 : 1), this.flashGeo, this.sparkGeo);
    if (target.isPlayer) { this.damageFlash = Math.min(1, this.damageFlash + 0.75); this.shake = Math.max(this.shake, 1.1); }
    if (!trackBroken && (target.trackLeftTimer > 0 || target.trackRightTimer > 0)) {
      this.effectsManager.spawnImpact(this._v3a.copy(point).setY(point.y + 0.5), 1.2, this.flashGeo, this.sparkGeo);
    }
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      target.mesh.group.visible = false;
      this.effectsManager.spawnImpact(point.clone().setY(2), 3.0, this.flashGeo, this.sparkGeo);
      this.addCrater(point);
      if (target.isPlayer) this.endGame("lose");
      else { if (attacker.isPlayer) this.kills++; this.pushHud(); if (this.bots.every((b) => b.dead)) this.endGame("win"); }
    } else { this.pushHud(); }
  }

  // ---- end ----

  private endGame(result: GameResult) {
    if (this.ended !== null) return;
    this.ended = result;
    if (document.pointerLockElement) document.exitPointerLock();
    const goldEarned = (result === "win" ? 100 : 0) + this.kills * 25;
    const survived = result === "win";
    let xp = this.kills * 100 + Math.floor(this.statsDamage / 10);
    if (result === "win") xp = Math.round(xp * 1.5);
    if (survived) xp = Math.round(xp * 1.2);
    this.cb.onEnd(result, {
      kills: this.kills,
      damageDealt: this.statsDamage,
      accuracy: this.statsShotsFired > 0 ? Math.round(this.statsShotsHit / this.statsShotsFired * 100) : 0,
      shotsFired: this.statsShotsFired,
      shotsHit: this.statsShotsHit,
      goldEarned,
      xpEarned: xp,
      survived,
    });
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
    this.pickupAlertTimer = Math.max(0, this.pickupAlertTimer - 0.1);
    const s: HudState = {
      playerHealth: Math.max(0, this.player.health),
      playerMaxHealth: this.player.spec.maxHealth,
      botsAlive: aliveBots, botsTotal: this.bots.length, kills: this.kills,
      reloadPct: 1 - this.player.reload / (this.player.spec.reloadTime * this.player.reloadMul),
      ready: (this.player.reload <= 0.001 || this.player.magazineAmmo > 0) && !this.player.dead,
      speedKmh: Math.abs(this.player.velocity) * 3.6,
      hullHeadingDeg: toDeg(this.player.hullAngle),
      turretHeadingDeg: toDeg(this.player.hullAngle + this.player.turretAngle),
      barrelPitchDeg: (this.player.barrelPitch * 180) / Math.PI,
      damageFlash: this.damageFlash,
      targetName: target ? target.spec.name : "",
      targetHealth: target ? Math.max(0, target.health) : 0,
      targetMaxHealth: target ? target.spec.maxHealth : 0,
      modules: { ...this.player.modules },
      ammo: { ...this.player.ammo, current: this.player.ammo.current },
      magAmmo: this.player.magazineAmmo, magSize: this.player.magazineSize,
      minimapEntities: this.allTanks.map((t) => ({
        x: t.mesh.group.position.x,
        z: t.mesh.group.position.z,
        heading: toDeg(t.hullAngle),
        isPlayer: t.isPlayer,
        isEnemy: !t.isPlayer,
        dead: t.dead,
      })),
      pickupAlert: this.pickupAlertTimer > 0 ? this.pickupAlert : "",
    };
    this.damageFlash = Math.max(0, this.damageFlash - 0.06);
    this.cb.onHud(s);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbindEvents();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const c of this.craters) { this.scene.remove(c); c.geometry.dispose(); }
    this.craters.length = 0;
    this.shellGeo?.dispose();
    this.shellMat?.dispose();
    this.trailMat?.dispose();
    this.sparkGeo?.dispose();
    this.flashGeo?.dispose();
    this.craterMat?.dispose();
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}
