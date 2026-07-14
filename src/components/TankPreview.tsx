import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TankModel, CamoType } from "../types";
import { TANK_SPECS, createTankMesh } from "../game/tanks";
import { buildHangarFloor } from "./hangar/Floor";
import { buildHangarWalls } from "./hangar/Walls";
import { buildHangarLights } from "./hangar/Lights";
import { buildTools } from "./hangar/Tools";
import { CAMO_COLORS } from "../data/upgrades";

export default function TankPreview({ tankModel, camo }: { tankModel: TankModel; camo?: CamoType }) {
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
    renderer.shadowMap.type = THREE.PCFShadowMap;
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

    const tankPivot = new THREE.Group();
    tankPivot.position.y = 0;
    const bodyColor = camo ? (CAMO_COLORS[camo] || undefined) : undefined;
    tankPivot.add(createTankMesh(spec, "player", bodyColor, camo || undefined).group);
    scene.add(tankPivot);

    const stampMat = new THREE.MeshStandardMaterial({
      color: 0xb6d94c, emissive: 0x2c3a0e, emissiveIntensity: 0.4, roughness: 0.4, transparent: true, opacity: 0.65,
    });
    const stamp = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.85, 48), stampMat);
    stamp.rotation.x = -Math.PI / 2; stamp.position.y = 0.02; scene.add(stamp);
    const innerStamp = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.7, 48), stampMat);
    innerStamp.rotation.x = -Math.PI / 2; innerStamp.position.y = 0.02; scene.add(innerStamp);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff4500, emissiveIntensity: 1.2, roughness: 0.2 }),
    );
    beacon.position.set(0, 5.6, 0); scene.add(beacon);
    const beaconLight = new THREE.PointLight(0xff6a00, 8, 10, 2);
    beaconLight.position.copy(beacon.position); scene.add(beaconLight);

    let dragging = false;
    let lastX = 0, lastY = 0;
    let velYaw = 0, velPitch = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; velYaw = 0; velPitch = 0;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velYaw = -dx * 0.003; velPitch = dy * 0.002;
      yaw += velYaw; pitch = Math.max(0.02, Math.min(0.55, pitch + velPitch));
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); distance = Math.max(6, Math.min(20, distance + e.deltaY * 0.005)); };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let raf = 0;
    let disposed = false;
    const timer = new THREE.Timer();
    const render = () => {
      if (disposed) return;
      raf = requestAnimationFrame(render);
      const dt = Math.min(timer.getDelta(), 0.1);
      if (!dragging) {
        const decay = Math.pow(0.001, dt);
        velYaw *= decay; velPitch *= decay;
        yaw += velYaw; pitch = Math.max(0.02, Math.min(0.55, pitch + velPitch));
        yaw += dt * 0.15;
      }
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      camera.position.set(Math.sin(yaw) * cp * distance, target.y + sp * distance + 2.0, Math.cos(yaw) * cp * distance);
      camera.lookAt(target);
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
  }, [tankModel, camo]);

  return <div ref={containerRef} className="h-full w-full" />;
}
