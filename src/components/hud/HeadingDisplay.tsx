import type { HudState } from "../../types";

function Tick({ heading, label }: { heading: number; label: string }) {
  const angle = ((heading + 180) % 360) - 180;
  const pct = (angle + 180) / 360;
  return (
    <div className="flex items-center gap-1">
      <span className="mono text-[7px] uppercase text-lime-600/70 w-7 text-right">{label}</span>
      <svg width="40" height="10" viewBox="0 0 40 10">
        <rect x="0" y="3.5" width="40" height="3" rx="1.5" fill="rgba(0,0,0,0.5)" />
        <rect x="0" y="3.5" width={pct * 40} height="3" rx="1.5" fill="#b6d94c" opacity="0.6" />
        <line x1={pct * 40} y1="1.5" x2={pct * 40} y2="8.5" stroke="#b6d94c" strokeWidth="1.5" opacity="0.8" />
        {[-180, -90, 0, 90, 180].map(d => {
          const pos = ((d + 180) / 360) * 40;
          if (pos < 0 || pos > 40) return null;
          return <line key={d} x1={pos} y1="4" x2={pos} y2="6" stroke="#5a6a42" strokeWidth="0.5" />;
        })}
      </svg>
      <span className="mono text-[9px] tabular-nums text-lime-300 w-7 text-right">
        {String(Math.round(heading)).padStart(3, "0")}°
      </span>
    </div>
  );
}

export default function HeadingDisplay({ hud }: { hud: HudState }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <Tick heading={hud.hullHeadingDeg} label="К" />
      <Tick heading={hud.turretHeadingDeg} label="Б" />
      <div className="flex items-center gap-1 ml-1">
        <span className="mono text-[7px] uppercase text-lime-600/70">УВС</span>
        <span className="mono text-[9px] tabular-nums text-lime-300">
          {hud.barrelPitchDeg >= 0 ? "+" : ""}{hud.barrelPitchDeg.toFixed(1)}°
        </span>
      </div>
    </div>
  );
}
