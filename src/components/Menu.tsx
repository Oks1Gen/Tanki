import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameSettings, TankModel } from "../types";
import { TANK_ORDER, TANK_SPECS } from "../game/tanks";
import TankPreview from "./TankPreview";

const STAT_LABELS = {
  armor: "Броня",
  speed: "Скорость",
  damage: "Огневая мощь",
  reload: "Темп огня",
} as const;

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[104px_1fr_30px] items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-lime-700/90">{label}</span>
      <div className="h-1.5 overflow-hidden bg-[#26301b]">
        <div
          className="h-full bg-gradient-to-r from-[#3f5a1e] to-lime-400 transition-[width] duration-300"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-right text-[10px] font-bold tabular-nums text-lime-200/80">{Math.round(value * 100)}</span>
    </div>
  );
}

export default function Menu({ onStart }: { onStart: (settings: GameSettings) => void }) {
  const [tank, setTank] = useState<TankModel>("t34");
  const [bots, setBots] = useState(5);
  const spec = TANK_SPECS[tank];
  const setBotCount = (count: number) => setBots(Math.max(1, Math.min(12, count)));
  const rangeStyle = { "--range-progress": `${((bots - 1) / 11) * 100}%` } as CSSProperties;

  return (
    <div className="relative min-h-dvh overflow-y-auto bg-[#0b0f09] text-lime-50 lg:h-dvh lg:overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(900px 520px at 18% 38%, rgba(95,138,46,0.2), transparent 66%), radial-gradient(760px 460px at 86% 14%, rgba(63,90,36,0.28), transparent 66%), radial-gradient(700px 520px at 60% 110%, rgba(40,60,24,0.4), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-[1500px] flex-col gap-4 px-4 py-4 lg:h-dvh lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-end justify-between gap-6 border-b border-zinc-800/80 pb-4">
          <div className="flex items-end gap-5">
            <div className="h-12 w-12 shrink-0 bg-[#4d6a24] ring-2 ring-lime-500/50" style={{ clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)" }}>
              <div className="flex h-full w-full items-center justify-center pt-2 stencil text-[10px] text-lime-100">C-01</div>
            </div>
            <div>
              <div className="ui-kicker mb-1">Полевой штаб · командование сектора</div>
              <h1 className="stencil text-3xl leading-none sm:text-4xl">
                Стальной <span className="text-lime-400">Штурм</span>
              </h1>
            </div>
            <div className="menu-low-priority hidden max-w-sm border-l border-lime-900/60 pl-5 text-xs leading-relaxed text-lime-200/60 md:block">
              Подготовьте машину и утвердите численность противника. После команды «В бой» сектор считается активным.
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="ui-kicker">Режим боя</div>
            <div className="mt-1 stencil text-lime-100">Все против всех</div>
            <div className="mt-2 mono text-[10px] uppercase text-lime-700/80">Канал связи · ALPHA-7</div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.72fr)]">
          <section className="ui-panel flex min-h-[520px] flex-col overflow-hidden lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between border-b border-lime-900/50 bg-black/35 px-5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-lime-400 shadow-[0_0_10px_#b6d94c]" />
                <span className="ui-kicker">Ангар № 04 · осмотр машины</span>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="mono text-[10px] uppercase text-lime-700/80">ЛКМ — вращать</span>
                <span className="h-3 w-px bg-lime-900/70" />
                <span className="mono text-[10px] uppercase text-lime-700/80">колёсико — приближение</span>
              </div>
            </div>
            <div className="relative min-h-[330px] flex-1">
              <TankPreview tankModel={tank} />
              <div className="pointer-events-none absolute left-5 top-5">
                <div className="ui-kicker">Утверждённая техника</div>
                <div className="stencil mt-1 text-3xl text-lime-50">{spec.name}</div>
                <div className="mono mt-1 text-[11px] uppercase tracking-[0.18em] text-lime-200/70">{spec.role} · класс «{spec.id.toUpperCase()}»</div>
              </div>
              <div className="pointer-events-none absolute bottom-4 left-5 right-5 flex items-end justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-lime-700/80">
                  Зажмите мышь, чтобы осмотреть машину
                </span>
                <span className="hazard-stripes pointer-events-none h-2 w-32 opacity-80" />
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 border-t border-lime-900/50 bg-black/35">
              {TANK_ORDER.map((id, index) => {
                const item = TANK_SPECS[id];
                const active = id === tank;
                return (
                  <button
                    key={id}
                    onClick={() => setTank(id)}
                    className={`relative min-w-0 px-4 py-3 text-left transition-colors sm:px-5 sm:py-4 ${
                      index > 0 ? "border-l border-lime-900/50" : ""
                    } ${active ? "bg-lime-900/25" : "hover:bg-lime-400/[0.05]"}`}
                  >
                    <span className={`absolute inset-x-0 top-0 h-0.5 ${active ? "bg-lime-400" : "bg-transparent"}`} />
                    <span className={`stencil block text-base sm:text-lg ${active ? "text-lime-50" : "text-lime-200/60"}`}>
                      {item.name}
                    </span>
                    <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-lime-700/70">
                      {item.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="ui-panel flex min-h-0 flex-col p-5 lg:overflow-hidden xl:p-6">
            <section className="shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="ui-kicker">01 / Технические данные</div>
                  <h2 className="stencil mt-1 text-xl">Характеристики</h2>
                </div>
                <div className="text-right">
                  <div className="stencil text-2xl text-lime-50">{spec.maxHealth}</div>
                  <div className="mono text-[9px] uppercase tracking-widest text-lime-700/80">прочность</div>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {(Object.keys(spec.stats) as Array<keyof typeof spec.stats>).map((key) => (
                  <StatBar key={key} label={STAT_LABELS[key]} value={spec.stats[key]} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-lime-900/50 border border-lime-900/50 bg-black/30 py-3 text-center">
                <div>
                  <div className="stencil text-sm tabular-nums text-lime-100">{spec.maxSpeed}</div>
                  <div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">скорость, км/ч</div>
                </div>
                <div>
                  <div className="stencil text-sm tabular-nums text-lime-100">{spec.damage}</div>
                  <div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">бронепробитие</div>
                </div>
                <div>
                  <div className="stencil text-sm tabular-nums text-lime-100">{spec.reloadTime.toFixed(1)}с</div>
                  <div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">перезарядка</div>
                </div>
              </div>
            </section>

            <section className="mt-5 shrink-0">
              <div className="flex items-end justify-between">
                <div>
                  <div className="ui-kicker">02 / Численность противника</div>
                  <h2 className="stencil mt-1 text-xl">Диспозиция</h2>
                </div>
                <div className="text-right">
                  <span className="stencil text-4xl text-lime-400">{bots}</span>
                  <span className="mono ml-2 text-[10px] uppercase tracking-widest text-lime-700/80">вражеских единиц</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setBotCount(bots - 1)}
                  aria-label="Уменьшить количество ботов"
                  className="ui-button-secondary h-10 w-10 shrink-0 text-2xl font-light"
                >
                  −
                </button>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={bots}
                  onChange={(event) => setBotCount(Number(event.target.value))}
                  style={rangeStyle}
                  className="battle-range w-full"
                  aria-label="Количество ботов"
                />
                <button
                  onClick={() => setBotCount(bots + 1)}
                  aria-label="Увеличить количество ботов"
                  className="ui-button-secondary h-10 w-10 shrink-0 text-2xl font-light"
                >
                  +
                </button>
              </div>
              <div className="mt-2 flex justify-between mono text-[9px] uppercase tracking-wider text-lime-700/80">
                <span>Дуэль · 1</span>
                <span>Массовый бой · 12</span>
              </div>
            </section>

            <section className="menu-low-priority mt-5 min-h-0 flex-1 border-t border-lime-900/50 pt-4">
              <div className="ui-kicker">Позывной оператора</div>
              <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 mono text-[10px]">
                {[
                  ["W A S D", "движение"],
                  ["МЫШЬ", "прицел / обзор"],
                  ["ЛКМ · ПРОБЕЛ", "огонь"],
                  ["ESC", "пауза"],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center justify-between gap-3 border-b border-lime-900/40 pb-2">
                    <span className="rounded-sm border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 font-black uppercase tracking-wider text-lime-200">{key}</span>
                    <span className="text-lime-200/60">{action}</span>
                  </div>
                ))}
              </div>
            </section>

            <button
              onClick={() => onStart({ tankModel: tank, botCount: bots })}
              className="ui-button-primary mt-5 flex w-full shrink-0 items-center justify-center gap-3 px-6 py-4 stencil"
            >
              <span className="h-2 w-2 bg-lime-300 shadow-[0_0_10px_#b6d94c]" />
              Начать бой
              <span className="h-2 w-2 bg-lime-300 shadow-[0_0_10px_#b6d94c]" />
            </button>
          </aside>
        </main>
      </div>
    </div>
  );
}