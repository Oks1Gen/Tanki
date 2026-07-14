import type { HudState } from "../../types";

export default function EnemyTarget({ hud }: { hud: HudState }) {
  if (!hud.targetName) return null;
  const pct = Math.max(0, hud.targetHealth / hud.targetMaxHealth);
  const color = pct > 0.5 ? "#b6d94c" : pct > 0.25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
      <svg width="8" height="40" viewBox="0 0 8 40" className="shrink-0">
        <rect x="3" y="0" width="2" height="40" rx="1" fill="rgba(0,0,0,0.5)" />
        <rect x="3" y={40 - pct * 40} width="2" height={pct * 40} rx="1" fill={color} />
        <line x1="0" y1="20" x2="8" y2="20" stroke="rgba(182,217,76,0.3)" strokeWidth="0.5" />
      </svg>
      <div className="flex flex-col">
        <span className="mono text-[8px] uppercase tracking-wider text-lime-300/80">{hud.targetName}</span>
        <span className="mono text-[9px] tabular-nums" style={{ color }}>{Math.ceil(hud.targetHealth)}</span>
      </div>
    </div>
  );
}
