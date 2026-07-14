import type { HudState, GameResult, GameStats } from "../../types";

export default function GameOverOverlay({ result, stats, hud, onRestart, onExit }: { result: GameResult; stats: GameStats | null; hud: HudState; onRestart: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/78 px-4 backdrop-blur-sm">
      <div className="ui-panel relative w-full max-w-lg p-8 text-center">
        <div className="ui-kicker">Сводка операции</div>
        <h2 className={`stencil mt-2 text-5xl ${result === "win" ? "text-lime-400" : "text-red-500"}`}>
          {result === "win" ? "Сектор зачищен" : "Машина потеряна"}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="text-xs text-lime-300/60">Уничтожено</div>
          <div className="text-xs text-right font-bold">{stats?.kills ?? hud.kills}</div>
          <div className="text-xs text-lime-300/60">Урон</div>
          <div className="text-xs text-right font-bold">{stats?.damageDealt ?? 0}</div>
          <div className="text-xs text-lime-300/60">Точность</div>
          <div className="text-xs text-right font-bold">{stats?.accuracy ?? 0}%</div>
          <div className="text-xs text-lime-300/60">Выстрелов</div>
          <div className="text-xs text-right font-bold">{stats?.shotsFired ?? 0} ({stats?.shotsHit ?? 0} поп.)</div>
          <div className="text-xs text-lime-300/60 border-t border-lime-900/40 pt-2">Опыт</div>
          <div className="text-xs text-right font-bold text-yellow-400 border-t border-lime-900/40 pt-2">+{stats?.xpEarned ?? 0}</div>
          <div className="text-xs text-lime-300/60">Золото</div>
          <div className="text-xs text-right font-bold text-yellow-400">+{stats?.goldEarned ?? 0}</div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button onClick={onRestart} className="ui-button-primary px-5 py-3 stencil">Повторить бой</button>
          <button onClick={onExit} className="ui-button-secondary px-5 py-3 stencil">В меню</button>
        </div>
      </div>
    </div>
  );
}
