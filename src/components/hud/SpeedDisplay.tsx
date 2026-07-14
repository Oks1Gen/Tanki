import type { HudState } from "../../types";

function SpeedIcon({ value }: { value: number }) {
  const pct = Math.min(1, value / 60);
  const angle = -120 + pct * 240;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#3a4432" strokeWidth="1.5" />
      <path d="M12 12 L12 4" stroke="#b6d94c" strokeWidth="1.5" strokeLinecap="round"
        transform={`rotate(${angle} 12 12)`} opacity="0.85" />
      <circle cx="12" cy="12" r="1.8" fill="#b6d94c" opacity="0.7" />
      {[0, 1, 2, 3].map((i) => {
        const a = (-120 + i * 80) * Math.PI / 180;
        const x1 = 12 + Math.cos(a) * 7, y1 = 12 + Math.sin(a) * 7;
        const x2 = 12 + Math.cos(a) * 9, y2 = 12 + Math.sin(a) * 9;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a6a42" strokeWidth="1" />;
      })}
    </svg>
  );
}

export default function SpeedDisplay({ hud }: { hud: HudState }) {
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-2">
      <SpeedIcon value={hud.speedKmh} />
      <div className="flex items-end gap-0.5">
        <span className="stencil text-lg text-lime-50 tabular-nums leading-none">{Math.round(hud.speedKmh)}</span>
        <span className="mono text-[7px] uppercase text-lime-700/60 pb-px">км/ч</span>
      </div>
    </div>
  );
}
