import type { HudState } from "../../types";

export default function CombatTally({ hud }: { hud: HudState }) {
  return (
    <div className="absolute right-4 top-4 flex items-start gap-3">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="stencil text-lg text-lime-50 leading-none">{hud.kills}</span>
          <span className="mono text-[9px] text-lime-700/60 leading-none">/ {hud.botsTotal}</span>
        </div>
        <span className="mono text-[7px] uppercase tracking-widest text-lime-700/60">подбито</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400 shadow-[0_0_8px_#b6d94c]" />
          <span className="stencil text-xl text-lime-400 leading-none">{hud.botsAlive}</span>
        </div>
        <span className="mono text-[7px] uppercase tracking-widest text-lime-700/60">осталось</span>
      </div>
      <div className="h-10 w-0.5 rounded-full bg-lime-700/40" />
    </div>
  );
}
