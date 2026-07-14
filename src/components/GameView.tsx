import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult, GameSettings, HudState } from "../types";
import { TankGame } from "../game/TankGame";
import { TANK_SPECS } from "../game/tanks";

const CARDINALS: { deg: number; label: string }[] = [
  { deg: 0, label: "С" },
  { deg: 45, label: "СВ" },
  { deg: 90, label: "В" },
  { deg: 135, label: "ЮВ" },
  { deg: 180, label: "Ю" },
  { deg: 225, label: "ЮЗ" },
  { deg: 270, label: "З" },
  { deg: 315, label: "СЗ" },
];

function CompassTape({ heading, width = 360 }: { heading: number; width?: number }) {
  // Build a row of tick marks ±90° around the current heading.
  const span = 90;
  const step = 5;
  const ticks = useMemo(() => {
    const arr: { offset: number; deg: number; cardinal?: string }[] = [];
    for (let d = -span; d <= span; d += step) {
      const worldDeg = ((heading + d) % 360 + 360) % 360;
      const card = CARDINALS.find((c) => Math.abs(((worldDeg - c.deg + 540) % 360) - 180) <= 1);
      arr.push({ offset: d, deg: Math.round(worldDeg), cardinal: card?.label });
    }
    return arr;
  }, [heading]);

  return (
    <div className="pointer-events-none relative" style={{ width, height: 32 }}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          {ticks.map((t, i) => {
            const leftPct = ((t.offset + span) / (span * 2)) * 100;
            const isMajor = t.offset % 15 === 0;
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
              >
                <div className={`mono ${isMajor ? "h-3 w-px bg-lime-300/80" : "h-1.5 w-px bg-lime-700/60"}`} />
                {t.cardinal ? (
                  <div className="stencil mt-0.5 text-[10px] text-lime-200">{t.cardinal}</div>
                ) : isMajor ? (
                  <div className="mono mt-0.5 text-[9px] text-lime-400/70">{String(t.deg).padStart(3, "0")}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* Centre reticle */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-lime-400" />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 border-x-[5px] border-t-[6px] border-x-transparent border-t-lime-400" />
    </div>
  );
}

function Crosshair({ ready, x, y, pitchDeg }: { ready: boolean; x: number; y: number; pitchDeg: number }) {
  const color = ready ? "#b6d94c" : "#8a9a6a";
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${(x + 1) * 50}%`, top: `${(1 - y) * 50}%` }}
    >
      <div className="relative h-16 w-16">
        {/* Outer range ring */}
        <span className="absolute inset-0 rounded-full border border-lime-400/35" />
        <span className="absolute inset-2 rounded-full border border-lime-400/20" />
        {/* Crosshair posts */}
        <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2" style={{ background: color }} />
        <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2" style={{ background: color }} />
        <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2" style={{ background: color }} />
        <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2" style={{ background: color }} />
        {/* Centre dot */}
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {/* Pitch indicator below the ring */}
        <span className="mono absolute left-1/2 top-[78px] -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.18em]" style={{ color }}>
          {ready ? "огонь" : "заряжание"} · {pitchDeg >= 0 ? "+" : ""}{pitchDeg.toFixed(0)}°
        </span>
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const base = "pointer-events-none absolute h-6 w-6 border-lime-400/70";
  const map = {
    tl: "left-3 top-3 border-l-2 border-t-2",
    tr: "right-3 top-3 border-r-2 border-t-2",
    bl: "left-3 bottom-3 border-l-2 border-b-2",
    br: "right-3 bottom-3 border-r-2 border-b-2",
  } as const;
  return <span className={`${base} ${map[position]}`} />;
}

export default function GameView({
  settings,
  onExit,
  onRestart,
}: {
  settings: GameSettings;
  onExit: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TankGame | null>(null);
  const [hud, setHud] = useState<HudState>({
    playerHealth: 1,
    playerMaxHealth: 1,
    botsAlive: settings.botCount,
    botsTotal: settings.botCount,
    kills: 0,
    reloadPct: 1,
    ready: true,
    speedKmh: 0,
    hullHeadingDeg: 180,
    turretHeadingDeg: 180,
    barrelPitchDeg: 0,
    damageFlash: 0,
  });
  const [paused, setPaused] = useState(true);
  const [ended, setEnded] = useState<GameResult>(null);
  const [aim, setAim] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new TankGame(canvasRef.current, settings, {
      onHud: setHud,
      onEnd: setEnded,
      onPause: setPaused,
      onAim: (x, y) => setAim({ x, y }),
    });
    gameRef.current = game;
    game.start();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [settings]);

  const spec = TANK_SPECS[settings.tankModel];
  const healthPct = Math.max(0, hud.playerHealth / hud.playerMaxHealth);
  const healthColor = healthPct > 0.5 ? "#22c55e" : healthPct > 0.25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Subtle film-grain + scanline overlay for tactical feel */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 60%, transparent 60%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Damage flash vignette — flashes red at the edges when the player is hit. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: Math.min(1, hud.damageFlash),
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 40%, rgba(180,20,20,0.55) 90%, rgba(140,10,10,0.85) 100%)",
          boxShadow: hud.damageFlash > 0.01 ? "inset 0 0 120px rgba(180,20,20,0.65)" : "none",
        }}
      />

      <div className="pointer-events-none absolute inset-0 select-none">
        {/* Screen corner brackets — tactical framing. */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        <Crosshair ready={hud.ready} x={aim.x} y={aim.y} pitchDeg={hud.barrelPitchDeg} />

        {/* Top centre: compass tape showing turret azimuth. */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <div className="hud-panel hud-corner flex flex-col items-center px-5 py-2">
            <div className="mb-1 flex items-center gap-3">
              <span className="ui-kicker">Курс орудия</span>
              <span className="stencil text-sm text-lime-200">
                {String(Math.round(hud.turretHeadingDeg)).padStart(3, "0")}°
              </span>
            </div>
            <CompassTape heading={hud.turretHeadingDeg} />
          </div>
        </div>

        {/* Left top: vehicle status panel. */}
        <div className="hud-panel hud-corner absolute left-4 top-4 w-[300px] px-4 py-3 sm:left-5 sm:top-5 sm:w-[320px]">
          <div className="flex items-center justify-between">
            <div className="ui-kicker">Бронемашина · 01</div>
            <div className="mono text-[9px] text-lime-600/80">ID-{spec.id.toUpperCase()}</div>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div className="stencil text-xl text-lime-50">{spec.name}</div>
            <div className="text-right">
              <div className="stencil text-2xl text-lime-50">{Math.ceil(hud.playerHealth)}</div>
              <div className="mono text-[8px] uppercase tracking-widest text-lime-700/80">/ {hud.playerMaxHealth}</div>
            </div>
          </div>
          <div className="relative mt-3 h-2.5 overflow-hidden border border-lime-900/60 bg-black/70">
            <div
              className="h-full transition-[width] duration-150"
              style={{ width: `${healthPct * 100}%`, background: healthColor }}
            />
            <div className="pointer-events-none absolute inset-0 flex">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex-1 border-r border-black/60 last:border-r-0" />
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between mono text-[9px] uppercase tracking-[0.14em] text-lime-700/80">
            <span>Бронезащита</span>
            <span>{Math.round(healthPct * 100)}%</span>
          </div>
        </div>

        {/* Right top: combat tally. */}
        <div className="hud-panel hud-corner absolute right-4 top-4 w-[220px] px-4 py-3 sm:right-5 sm:top-5">
          <div className="flex items-center justify-between">
            <div className="ui-kicker">Сектор обороны</div>
            <div className="h-2 w-2 animate-pulse rounded-full bg-lime-400 shadow-[0_0_8px_#b6d94c]" />
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <div className="stencil text-3xl text-lime-400">{hud.botsAlive}</div>
              <div className="mono text-[8px] uppercase tracking-widest text-lime-700/80">целей</div>
            </div>
            <div className="text-right">
              <div className="stencil text-2xl text-lime-50">{hud.kills}</div>
              <div className="mono text-[8px] uppercase tracking-widest text-lime-700/80">подбито / {hud.botsTotal}</div>
            </div>
          </div>
        </div>

        {/* Bottom centre: wide tactical bar with reload + speed + pitch. */}
        <div className="hud-panel hud-corner absolute bottom-4 left-1/2 w-[560px] max-w-[92vw] -translate-x-1/2 px-4 py-3 sm:w-[640px]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            {/* Reload readout */}
            <div className="flex min-w-[150px] flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 ${hud.ready ? "bg-lime-400 shadow-[0_0_8px_#b6d94c]" : "bg-amber-400"}`} />
                  <span className="ui-kicker">{hud.ready ? "Огонь" : "Заряжание"}</span>
                </div>
                <span className="mono text-[10px] text-lime-200">{Math.round(hud.reloadPct * 100)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden border border-lime-900/60 bg-black/70">
                <div
                  className="h-full transition-[width] duration-75"
                  style={{ width: `${hud.reloadPct * 100}%`, background: hud.ready ? "#b6d94c" : "#d7a53a" }}
                />
              </div>
            </div>

            {/* Speed readout (analogue-ish) */}
            <div className="flex flex-col items-center">
              <div className="ui-kicker">Скорость</div>
              <div className="mt-0.5 flex items-end gap-1">
                <span className="stencil text-3xl text-lime-50 tabular-nums">{Math.round(hud.speedKmh)}</span>
                <span className="mono pb-1 text-[9px] uppercase text-lime-700/80">км/ч</span>
              </div>
              <div className="mt-1 flex w-40 gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = (i + 1) / 12;
                  const lit = hud.speedKmh / 60 >= threshold;
                  const color = i < 8 ? "#b6d94c" : i < 10 ? "#d7a53a" : "#b32020";
                  return (
                    <div
                      key={i}
                      className="h-1.5 flex-1 border border-black/40"
                      style={{ background: lit ? color : "rgba(0,0,0,0.5)" }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Turret / hull heading */}
            <div className="flex min-w-[140px] flex-col items-end">
              <div className="ui-kicker">Наведение</div>
              <div className="mono mt-1 text-[11px] leading-tight text-lime-100">
                Корпус · <span className="tabular-nums text-lime-300">{String(Math.round(hud.hullHeadingDeg)).padStart(3, "0")}°</span>
              </div>
              <div className="mono text-[11px] leading-tight text-lime-100">
                Башня · <span className="tabular-nums text-lime-300">{String(Math.round(hud.turretHeadingDeg)).padStart(3, "0")}°</span>
              </div>
              <div className="mono text-[11px] leading-tight text-lime-100">
                УВС · <span className="tabular-nums text-lime-300">{hud.barrelPitchDeg >= 0 ? "+" : ""}{hud.barrelPitchDeg.toFixed(1)}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom left: control legend. */}
        <div className="hud-panel hud-corner absolute bottom-4 left-5 hidden max-w-[440px] flex-wrap px-4 py-2.5 mono text-[10px] uppercase tracking-[0.14em] text-lime-200/70 lg:flex lg:items-center lg:gap-2">
          <span className="border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 text-lime-200">WASD</span> движение
          <span className="border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 text-lime-200">МЫШЬ</span> прицел
          <span className="border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 text-lime-200">ЛКМ</span> огонь
          <span className="border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 text-lime-200">ESC</span> пауза
        </div>

        {/* Bottom right: channel tag. */}
        <div className="hud-panel hud-corner absolute right-5 bottom-[110px] hidden max-w-[340px] px-4 py-2 mono text-[10px] uppercase tracking-[0.14em] text-lime-200/70 sm:block">
          <span className="text-lime-300">Канал · ALPHA-7</span> · удерживать сектор
        </div>
      </div>

      {paused && ended === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
          <div className="ui-panel relative w-full max-w-md p-7 text-center">
            <div className="ui-kicker">Штаб на связи</div>
            <h2 className="stencil mt-2 text-4xl text-lime-50">Бой приостановлен</h2>
            <p className="mt-3 text-sm text-lime-200/60">Оператор в укрытии. Подтвердите продолжение или вернитесь на базу.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => gameRef.current?.requestLock()}
                className="ui-button-primary px-5 py-3 stencil"
              >
                Продолжить
              </button>
              <button onClick={onExit} className="ui-button-secondary px-5 py-3 stencil">
                В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {ended !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/78 px-4 backdrop-blur-sm">
          <div className="ui-panel relative w-full max-w-lg p-8 text-center">
            <div className="ui-kicker">Сводка операции</div>
            <h2 className={`stencil mt-2 text-5xl ${ended === "win" ? "text-lime-400" : "text-red-500"}`}>
              {ended === "win" ? "Сектор зачищен" : "Машина потеряна"}
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-lime-200/60">
              {ended === "win"
                ? `Лично уничтожено единиц противника: ${hud.kills}.`
                : "Машина потеряна. Измените тактику или выберите другой танк."}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button onClick={onRestart} className="ui-button-primary px-5 py-3 stencil">
                Повторить бой
              </button>
              <button onClick={onExit} className="ui-button-secondary px-5 py-3 stencil">
                В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}