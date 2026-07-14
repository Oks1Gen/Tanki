import type { HudState, TankModel } from "../../types";
import { TANK_SPECS } from "../../game/tanks";

export default function HealthReloadPanel({ hud, tankModel }: { hud: HudState; tankModel: TankModel }) {
  const spec = TANK_SPECS[tankModel];
  const hpPct = Math.max(0, hud.playerHealth / hud.playerMaxHealth);
  const hpColor = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="absolute left-4 top-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-0.5 rounded-full bg-lime-400 shadow-[0_0_6px_#b6d94c]" />
        <div>
          <div className="flex items-center gap-2">
            <span className="stencil text-sm text-lime-50 leading-none">{spec.name}</span>
            <span className="mono text-[8px] text-lime-600/60 leading-none">|</span>
            <span className="stencil text-xs text-lime-400 leading-none">{hud.kills}</span>
            <span className="mono text-[7px] text-lime-700/60 leading-none">уб.</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="mono text-[10px] tabular-nums" style={{ color: hpColor }}>
              {Math.ceil(hud.playerHealth)}
            </span>
            <span className="mono text-[8px] text-lime-700/60 leading-none">/ {hud.playerMaxHealth} HP</span>
          </div>
        </div>
      </div>
      <div className="relative h-1 w-44 overflow-hidden rounded-full bg-black/70">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${hpPct * 100}%`, background: hpColor }} />
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-black/40 last:border-r-0" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: hud.ready ? "#b6d94c" : "#f59e0b", boxShadow: hud.ready ? "0 0 6px #b6d94c" : "none" }}
        />
        <span className="mono text-[8px] uppercase tracking-wider" style={{ color: hud.ready ? "#b6d94c" : "#f59e0b" }}>
          {hud.ready ? "готов" : "заряжание"}
        </span>
        <div className="relative h-0.5 w-24 overflow-hidden rounded-full bg-black/70">
          <div className="h-full rounded-full transition-[width] duration-100" style={{
            width: `${hud.reloadPct * 100}%`,
            background: hud.ready ? "#b6d94c" : "#f59e0b",
          }} />
        </div>
      </div>
    </div>
  );
}
