import type { HudState } from "../../types";
import type { GameResult } from "../../types";

export default function GameOverOverlay({ result, hud, onRestart, onExit }: { result: GameResult; hud: HudState; onRestart: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/78 px-4 backdrop-blur-sm">
      <div className="ui-panel relative w-full max-w-lg p-8 text-center">
        <div className="ui-kicker">Сводка операции</div>
        <h2 className={`stencil mt-2 text-5xl ${result === "win" ? "text-lime-400" : "text-red-500"}`}>
          {result === "win" ? "Сектор зачищен" : "Машина потеряна"}
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-lime-200/60">
          {result === "win"
            ? `Лично уничтожено единиц противника: ${hud.kills}.`
            : "Машина потеряна. Измените тактику или выберите другой танк."}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button onClick={onRestart} className="ui-button-primary px-5 py-3 stencil">Повторить бой</button>
          <button onClick={onExit} className="ui-button-secondary px-5 py-3 stencil">В меню</button>
        </div>
      </div>
    </div>
  );
}
