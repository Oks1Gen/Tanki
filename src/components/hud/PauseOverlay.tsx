import type { TankGame } from "../../game/TankGame";

export default function PauseOverlay({ gameRef, onExit }: { gameRef: React.RefObject<TankGame | null>; onExit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
      <div className="ui-panel relative w-full max-w-md p-7 text-center">
        <div className="ui-kicker">Штаб на связи</div>
        <h2 className="stencil mt-2 text-4xl text-lime-50">Бой приостановлен</h2>
        <p className="mt-3 text-sm text-lime-200/60">Оператор в укрытии. Подтвердите продолжение или вернитесь на базу.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => gameRef.current?.requestLock()} className="ui-button-primary px-5 py-3 stencil">Продолжить</button>
          <button onClick={onExit} className="ui-button-secondary px-5 py-3 stencil">В меню</button>
        </div>
      </div>
    </div>
  );
}
