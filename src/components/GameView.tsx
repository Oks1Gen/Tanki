import { useEffect, useRef, useState } from "react";
import type { GameResult, GameSettings, HudState, GameStats } from "../types";
import { TankGame } from "../game/TankGame";
import HealthReloadPanel from "./hud/HealthReloadPanel";
import CombatTally from "./hud/CombatTally";
import HeadingDisplay from "./hud/HeadingDisplay";
import Minimap from "./hud/Minimap";
import PauseOverlay from "./hud/PauseOverlay";
import GameOverOverlay from "./hud/GameOverOverlay";

function Crosshair({ ready, x, y, pitchDeg }: { ready: boolean; x: number; y: number; pitchDeg: number }) {
  const color = ready ? "#b6d94c" : "#8a9a6a";
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(x + 1) * 50}%`, top: `${(1 - y) * 50}%` }}>
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 rounded-full border border-lime-400/30" />
        <span className="absolute inset-[5px] rounded-full border border-lime-400/15" />
        <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2" style={{ background: color }} />
        <span className="absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2" style={{ background: color }} />
        <span className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2" style={{ background: color }} />
        <span className="absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2" style={{ background: color }} />
        <span className="absolute left-1/2 top-1/2 h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="mono absolute left-1/2 top-[68px] -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-[0.18em]" style={{ color }}>
          {ready ? "огонь" : "заряжание"} · {pitchDeg >= 0 ? "+" : ""}{pitchDeg.toFixed(0)}°
        </span>
      </div>
    </div>
  );
}

export default function GameView({
  settings, onExit, onRestart, onGoldEarned, onXpEarned,
}: {
  settings: GameSettings;
  onExit: () => void;
  onRestart: () => void;
  onGoldEarned?: (gold: number) => void;
  onXpEarned?: (xp: number, result: "win" | "lose", stats: { kills: number; damage: number; shotsFired: number; shotsHit: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TankGame | null>(null);
  const [hud, setHud] = useState<HudState>({
    playerHealth: 1, playerMaxHealth: 1, botsAlive: settings.botCount, botsTotal: settings.botCount,
    kills: 0, reloadPct: 1, ready: true, speedKmh: 0,
    hullHeadingDeg: 180, turretHeadingDeg: 180, barrelPitchDeg: 0, damageFlash: 0,
    targetName: "", targetHealth: 0, targetMaxHealth: 0,
    modules: { trackLeft: 100, trackRight: 100, gun: 100, engine: 100 },
    ammo: { ap: 18, heat: 10, he: 8, current: "ap" },
    magAmmo: 1, magSize: 1,
    minimapEntities: [],
    pickupAlert: "",
  });
  const [paused, setPaused] = useState(true);
  const [ended, setEnded] = useState<GameResult>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [aim, setAim] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new TankGame(canvasRef.current, settings, {
      onHud: setHud,
      onEnd: (r, s) => {
        setEnded(r);
        if (s) {
          setStats(s);
          onGoldEarned?.(s.goldEarned);
          if (r !== null) onXpEarned?.(s.xpEarned, r, { kills: s.kills, damage: s.damageDealt, shotsFired: s.shotsFired, shotsHit: s.shotsHit });
        }
      },
      onPause: setPaused,
      onAim: (x, y) => setAim({ x, y }),
    });
    gameRef.current = game;
    game.start();
    return () => { game.dispose(); gameRef.current = null; };
  }, [settings]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Scanline overlay — very subtle */}
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.08]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 1px, rgba(255,255,255,0.04) 1px 2px)" }} />
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 80% at 50% 60%, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />

      {/* Damage flash */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: Math.min(1, hud.damageFlash * 0.7),
          background: "radial-gradient(120% 80% at 50% 50%, transparent 45%, rgba(180,20,20,0.5) 90%, rgba(140,10,10,0.7) 100%)",
          boxShadow: hud.damageFlash > 0.01 ? "inset 0 0 80px rgba(180,20,20,0.5)" : "none",
        }} />

      <div className="pointer-events-none absolute inset-0 select-none">
        <Crosshair ready={hud.ready} x={aim.x} y={aim.y} pitchDeg={hud.barrelPitchDeg} />
        {hud.magSize > 1 && (
          <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${(aim.x + 1) * 50}%`, top: `${(1 - aim.y) * 50 + 12.5}%` }}>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: hud.magSize }, (_, i) => (
                <span key={i} className={`block h-2 w-2 rounded-full ${i < hud.magAmmo ? 'bg-lime-400 shadow-[0_0_6px_#b6d94c]' : 'bg-lime-900/50'}`} />
              ))}
            </div>
          </div>
        )}
        <HealthReloadPanel hud={hud} tankModel={settings.tankModel} />
        <CombatTally hud={hud} />
        <Minimap entities={hud.minimapEntities} />
        <HeadingDisplay hud={hud} />
        {hud.pickupAlert && (
          <div className="absolute left-1/2 top-24 -translate-x-1/2 hud-panel px-4 py-1.5 mono text-[10px] text-lime-300">
            {hud.pickupAlert}
          </div>
        )}
        {/* Ammo & module status bottom-left */}
        <div className="absolute bottom-4 left-20 flex flex-col gap-0.5 mono text-[8px] text-lime-500/50">
          <div>
            <span className={hud.ammo.current === "ap" ? "text-lime-300" : ""}>AP</span>
            <span className="mx-1">|</span>
            <span className={hud.ammo.current === "heat" ? "text-lime-300" : ""}>HEAT</span>
            <span className="mx-1">|</span>
            <span className={hud.ammo.current === "he" ? "text-lime-300" : ""}>HE</span>
            <span className="ml-1 text-lime-400/70">{hud.ammo[hud.ammo.current]}</span>
          </div>
          <div>
            <span className={hud.modules.gun <= 0 ? "text-red-400" : ""}>⚙ {Math.ceil(hud.modules.gun)}%</span>
            <span className="mx-1">|</span>
            <span className={hud.modules.engine <= 0 ? "text-red-400" : ""}>⚡ {Math.ceil(hud.modules.engine)}%</span>
          </div>
        </div>
        {/* Keybind legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-0.5 mono text-[8px] uppercase tracking-[0.14em] text-lime-500/40">
          <div><span className="text-lime-300/60">WASD</span> движение</div>
          <div><span className="text-lime-300/60">МЫШЬ</span> прицел</div>
          <div><span className="text-lime-300/60">ЛКМ</span> огонь</div>
          <div><span className="text-lime-300/60">Q/E</span> тип снаряда</div>
          <div><span className="text-lime-300/60">ESC</span> пауза</div>
        </div>
      </div>

      {paused && ended === null && <PauseOverlay gameRef={gameRef} onExit={onExit} />}
      {ended !== null && <GameOverOverlay result={ended} stats={stats} hud={hud} onRestart={onRestart} onExit={onExit} />}
    </div>
  );
}
