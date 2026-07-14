import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameSettings, TankModel, PlayerProgress } from "../types";
import { TANK_ORDER, TANK_SPECS } from "../game/tanks";
import { UPGRADES, GOLD_UPGRADES, CAMO_ITEMS, CAMO_COLORS, TANK_UNLOCKS } from "../data/upgrades";
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
        <div className="h-full bg-gradient-to-r from-[#3f5a1e] to-lime-400 transition-[width] duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-right text-[10px] font-bold tabular-nums text-lime-200/80">{Math.round(value * 100)}</span>
    </div>
  );
}

export default function Menu({ progress, onStart, onBuy }: { progress: PlayerProgress; onStart: (settings: GameSettings) => void; onBuy: (id: string) => void }) {
  const [tank, setTank] = useState<TankModel>(progress.unlockedTanks.includes("t34") ? "t34" : progress.unlockedTanks[0]);
  const [bots, setBots] = useState(5);
  const [tab, setTab] = useState<"specs" | "research">("specs");
  const spec = TANK_SPECS[tank];
  const setBotCount = (count: number) => setBots(Math.max(1, Math.min(12, count)));
  const rangeStyle = { "--range-progress": `${((bots - 1) / 11) * 100}%` } as CSSProperties;
  const tankLocked = !progress.unlockedTanks.includes(tank);
  const availableGoldUpgrades = GOLD_UPGRADES.filter((g) => g.tankModel === tank && !progress.goldUpgrades[g.id]);

  return (
    <div className="relative min-h-dvh overflow-y-auto bg-[#0b0f09] text-lime-50 lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: "radial-gradient(900px 520px at 18% 38%, rgba(95,138,46,0.2), transparent 66%), radial-gradient(760px 460px at 86% 14%, rgba(63,90,36,0.28), transparent 66%), radial-gradient(700px 520px at 60% 110%, rgba(40,60,24,0.4), transparent 60%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative mx-auto flex min-h-dvh max-w-[1500px] flex-col gap-4 px-4 py-4 lg:h-dvh lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-end justify-between gap-6 border-b border-zinc-800/80 pb-4">
          <div className="flex items-end gap-5">
            <div className="h-12 w-12 shrink-0 bg-[#4d6a24] ring-2 ring-lime-500/50" style={{ clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)" }}>
              <div className="flex h-full w-full items-center justify-center pt-2 stencil text-[10px] text-lime-100">C-01</div>
            </div>
            <div>
              <div className="ui-kicker mb-1">Полевой штаб · командование сектора</div>
              <h1 className="stencil text-3xl leading-none sm:text-4xl">Стальной <span className="text-lime-400">Штурм</span></h1>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <div className="text-right border-r border-lime-900/50 pr-4">
              <div className="ui-kicker">Опыт</div>
              <div className="stencil text-lg text-yellow-400">{progress.xp}</div>
            </div>
            <div className="text-right border-r border-lime-900/50 pr-4">
              <div className="ui-kicker">Золото</div>
              <div className="stencil text-lg text-yellow-400">{progress.gold}</div>
            </div>
            <div className="text-right">
              <div className="ui-kicker">Режим боя</div>
              <div className="stencil text-lime-100">Все против всех</div>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.72fr)]">
          {/* Tank preview */}
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
              <TankPreview tankModel={tank} camo={progress.equippedCamo} />
              <div className="pointer-events-none absolute left-5 top-5">
                <div className="ui-kicker">Утверждённая техника</div>
                <div className="stencil mt-1 text-3xl text-lime-50">{spec.name}</div>
                <div className="mono mt-1 text-[11px] uppercase tracking-[0.18em] text-lime-200/70">{spec.role} · класс «{spec.id.toUpperCase()}»</div>
              </div>
              <div className="pointer-events-none absolute bottom-4 left-5 right-5 flex items-end justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-lime-700/80">Зажмите мышь, чтобы осмотреть машину</span>
                <span className="hazard-stripes pointer-events-none h-2 w-32 opacity-80" />
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-3 border-t border-lime-900/50 bg-black/35">
              {TANK_ORDER.map((id, index) => {
                const item = TANK_SPECS[id];
                const locked = !progress.unlockedTanks.includes(id);
                const unlockReq = TANK_UNLOCKS.find((u) => u.model === id);
                const active = id === tank;
                return (
                  <button key={id} onClick={() => !locked && setTank(id)} disabled={locked}
                    className={`relative min-w-0 px-4 py-3 text-left transition-colors sm:px-5 sm:py-4 ${index > 0 ? "border-l border-lime-900/50" : ""} ${active ? "bg-lime-900/25" : locked ? "opacity-40 cursor-not-allowed" : "hover:bg-lime-400/[0.05]"}`}>
                    <span className={`absolute inset-x-0 top-0 h-0.5 ${active ? "bg-lime-400" : "bg-transparent"}`} />
                    <span className={`stencil block text-base sm:text-lg ${active ? "text-lime-50" : locked ? "text-zinc-500" : "text-lime-200/60"}`}>{locked ? "\u{1F512} " : ""}{item.name}</span>
                    <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-lime-700/70">{locked && unlockReq?.xpCost ? `${unlockReq.xpCost} опыта` : item.role}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right panel */}
          <aside className="ui-panel flex min-h-0 flex-col p-5 lg:overflow-hidden xl:p-6">
            {/* Tabs */}
            <div className="flex gap-4 border-b border-lime-900/50 pb-2.5 shrink-0">
              <button onClick={() => setTab("specs")} className={`text-[10px] font-bold uppercase tracking-[0.14em] pb-0.5 transition-colors ${tab === "specs" ? "text-lime-300 border-b-2 border-lime-400" : "text-lime-700 hover:text-lime-400"}`}>Характеристики</button>
              <button onClick={() => setTab("research")} className={`text-[10px] font-bold uppercase tracking-[0.14em] pb-0.5 transition-colors ${tab === "research" ? "text-lime-300 border-b-2 border-lime-400" : "text-lime-700 hover:text-lime-400"}`}>НИОКР</button>
            </div>

            {/* Start button pinned top */}
            <button onClick={() => onStart({ tankModel: tank, botCount: bots, upgrades: progress.upgrades, goldUpgrades: progress.goldUpgrades, camo: progress.equippedCamo })}
              disabled={tankLocked}
              className={`ui-button-primary mt-3 flex w-full shrink-0 items-center justify-center gap-3 px-6 py-4 stencil text-sm ${tankLocked ? "opacity-40 cursor-not-allowed" : ""}`}>
              <span className="h-2 w-2 bg-lime-300 shadow-[0_0_10px_#b6d94c]" />
              {tankLocked ? "ТАНК ЗАБЛОКИРОВАН" : "НАЧАТЬ БОЙ"}
              <span className="h-2 w-2 bg-lime-300 shadow-[0_0_10px_#b6d94c]" />
            </button>

            {/* Specs tab */}
            {tab === "specs" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <section className="shrink-0 mt-4">
                  <div className="flex items-center justify-between">
                    <div><span className="ui-kicker">01 / Технические данные</span><h2 className="stencil mt-1 text-xl">Характеристики</h2></div>
                    <div className="text-right"><div className="stencil text-2xl text-lime-50">{spec.maxHealth}</div><div className="mono text-[9px] uppercase tracking-widest text-lime-700/80">прочность</div></div>
                  </div>
                  <div className="mt-4 space-y-2.5">{(Object.keys(spec.stats) as Array<keyof typeof spec.stats>).map((key) => (<StatBar key={key} label={STAT_LABELS[key]} value={spec.stats[key]} />))}</div>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-lime-900/50 border border-lime-900/50 bg-black/30 py-3 text-center">
                    <div><div className="stencil text-sm tabular-nums text-lime-100">{spec.maxSpeed}</div><div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">скорость, км/ч</div></div>
                    <div><div className="stencil text-sm tabular-nums text-lime-100">{spec.damage}</div><div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">бронепробитие</div></div>
                    <div><div className="stencil text-sm tabular-nums text-lime-100">{spec.reloadTime.toFixed(1)}с</div><div className="mono mt-0.5 text-[8px] uppercase tracking-widest text-lime-700/80">перезарядка</div></div>
                  </div>
                </section>

                {/* Camo */}
                {progress.purchasedCamos.length > 0 && (
                  <section className="shrink-0 mt-5 border-t border-lime-900/50 pt-4">
                    <span className="ui-kicker">Камуфляжное покрытие</span>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => onBuy("equipCamo_")} className={`h-7 w-7 rounded border ${progress.equippedCamo === "" ? "border-lime-400 ring-1 ring-lime-400" : "border-lime-900/50"} bg-[#278fe8]`} title="Стандарт" />
                      {progress.purchasedCamos.map((c) => (
                        <button key={c} onClick={() => onBuy("equipCamo_" + c)} className={`h-7 w-7 rounded border ${progress.equippedCamo === c ? "border-lime-400 ring-1 ring-lime-400" : "border-lime-900/50"}`} style={{ background: `#${CAMO_COLORS[c].toString(16).padStart(6, "0")}` }} title={c === "forest" ? "Лес" : c === "desert" ? "Пустыня" : "Зима"} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Stats */}
                <section className="menu-low-priority mt-5 shrink-0 border-t border-lime-900/50 pt-4">
                  <span className="ui-kicker">Статистика оператора</span>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 mono text-[10px]">
                    <div className="flex justify-between"><span className="text-lime-700">Боёв</span><span className="text-lime-200">{progress.stats.totalGames}</span></div>
                    <div className="flex justify-between"><span className="text-lime-700">Побед</span><span className="text-lime-200">{progress.stats.totalWins}</span></div>
                    <div className="flex justify-between"><span className="text-lime-700">Поражений</span><span className="text-lime-200">{progress.stats.totalLosses}</span></div>
                    <div className="flex justify-between"><span className="text-lime-700">Убийств</span><span className="text-lime-200">{progress.stats.totalKills}</span></div>
                    <div className="flex justify-between"><span className="text-lime-700">Урона</span><span className="text-lime-200">{progress.stats.totalDamage}</span></div>
                    <div className="flex justify-between"><span className="text-lime-700">Точность</span><span className="text-lime-200">{progress.stats.totalShotsFired > 0 ? Math.round(progress.stats.totalShotsHit / progress.stats.totalShotsFired * 100) : 0}%</span></div>
                  </div>
                </section>

                {/* Bot count */}
                <section className="mt-5 shrink-0">
                  <div className="flex items-end justify-between">
                    <div><span className="ui-kicker">02 / Численность противника</span><h2 className="stencil mt-1 text-xl">Диспозиция</h2></div>
                    <div className="text-right"><span className="stencil text-4xl text-lime-400">{bots}</span><span className="mono ml-2 text-[10px] uppercase tracking-widest text-lime-700/80">вражеских единиц</span></div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => setBotCount(bots - 1)} aria-label="Уменьшить" className="ui-button-secondary h-10 w-10 shrink-0 text-2xl font-light">−</button>
                    <input type="range" min="1" max="12" value={bots} onChange={(e) => setBotCount(Number(e.target.value))} style={rangeStyle} className="battle-range w-full" aria-label="Количество ботов" />
                    <button onClick={() => setBotCount(bots + 1)} aria-label="Увеличить" className="ui-button-secondary h-10 w-10 shrink-0 text-2xl font-light">+</button>
                  </div>
                  <div className="mt-2 flex justify-between mono text-[9px] uppercase tracking-wider text-lime-700/80"><span>Дуэль · 1</span><span>Массовый бой · 12</span></div>
                </section>

                {/* Controls */}
                <section className="menu-low-priority mt-5 min-h-0 flex-1 border-t border-lime-900/50 pt-4">
                  <span className="ui-kicker">Позывной оператора</span>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 mono text-[10px]">
                    {[["W A S D", "движение"], ["МЫШЬ", "прицел / обзор"], ["ЛКМ · ПРОБЕЛ", "огонь"], ["Q / E", "тип снаряда"], ["ESC", "пауза"]].map(([key, action]) => (
                      <div key={key} className="flex items-center justify-between gap-3 border-b border-lime-900/40 pb-2">
                        <span className="rounded-sm border border-lime-500/40 bg-lime-500/10 px-1.5 py-0.5 font-black uppercase tracking-wider text-lime-200">{key}</span>
                        <span className="text-lime-200/60">{action}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Research tab */}
            {tab === "research" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <section className="shrink-0 mt-4">
                  <span className="ui-kicker">03 / Научно-исследовательское бюро</span>
                  <h2 className="stencil mt-1 text-xl">Исследования</h2>
                  <p className="mt-2 text-[10px] leading-relaxed text-lime-600/80">Убийство: <span className="text-lime-300">100 XP</span> · Урон: <span className="text-lime-300">1/10 HP</span> · Победа: <span className="text-lime-300">×1.5</span> · Выживание: <span className="text-lime-300">×1.2</span></p>

                  {/* XP upgrades */}
                  <div className="mt-4 space-y-2">
                    {UPGRADES.map((u) => {
                      const level = progress.upgrades[u.id] || 0;
                      const maxed = level >= u.maxLevel;
                      const nextCost = maxed ? 0 : u.levels[level].xpCost;
                      const canBuy = !maxed && progress.xp >= nextCost;
                      const goldForAccel = Math.ceil(nextCost / 10);
                      const canAccel = !maxed && progress.gold >= goldForAccel;
                      return (
                        <div key={u.id} className={`border border-lime-900/50 bg-black/30 rounded px-3 py-2 ${maxed ? "opacity-50" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 shrink-1">
                              <span className="text-sm shrink-0">{u.icon}</span>
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold text-lime-100 leading-tight">{u.name}</div>
                                <div className="text-[9px] text-lime-600/80 leading-tight truncate">{level === 0 ? "не изучено" : `${u.levels.slice(0, level).map((l) => l.label).join(", ")}${maxed ? " (MAX)" : ` (${level}/${u.maxLevel})`}`}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!maxed && canAccel && <button onClick={() => onBuy("accelerate_" + u.id)} className="px-2 py-1 stencil text-[8px] rounded bg-yellow-800/40 text-yellow-400 hover:bg-yellow-800/60" title={`Ускорить за ${goldForAccel} золота`}>{goldForAccel}\uD83E\uDE99</button>}
                              <button onClick={() => onBuy(u.id)} disabled={maxed || !canBuy}
                                className={`px-2 py-1 stencil text-[9px] rounded transition-colors ${maxed ? "bg-lime-900/30 text-lime-600 cursor-default" : canBuy ? "bg-lime-700/50 text-lime-300 hover:bg-lime-700/70" : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"}`}>
                                {maxed ? "MAX" : canBuy ? `${nextCost} XP` : `${nextCost} XP\u{1F512}`}
                              </button>
                            </div>
                          </div>
                          <div className="mt-1.5 h-1 bg-zinc-800 rounded overflow-hidden"><div className="h-full bg-lime-500/60 rounded transition-all" style={{ width: `${(level / u.maxLevel) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gold upgrades */}
                  {availableGoldUpgrades.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <h3 className="stencil text-sm text-yellow-400/90">Золотые улучшения</h3>
                      {availableGoldUpgrades.map((g) => (
                        <div key={g.id} className="border border-yellow-900/50 bg-black/30 rounded px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-base shrink-0">{g.icon}</span>
                            <div className="flex-1 min-w-0 mx-1">
                              <div className="text-[10px] font-bold text-lime-100 leading-tight">{g.label}</div>
                              <div className="text-[9px] text-lime-600/80">{g.desc}</div>
                            </div>
                            <button onClick={() => onBuy("gold_" + g.id)} disabled={progress.gold < g.goldCost}
                              className={`shrink-0 px-2 py-1 stencil text-[9px] rounded transition-colors ${progress.gold >= g.goldCost ? "bg-yellow-700/50 text-yellow-300 hover:bg-yellow-700/70" : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"}`}>
                              {g.goldCost} \uD83E\uDE99
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Camos */}
                  <div className="mt-5 space-y-2">
                    <h3 className="stencil text-sm text-yellow-400/90">Премиум-камуфляжи</h3>
                    <div className="flex flex-wrap gap-2">
                      {CAMO_ITEMS.map((c) => {
                        const owned = progress.purchasedCamos.includes(c.type);
                        return (
                          <button key={c.type} onClick={() => !owned && onBuy("camo_" + c.type)}
                            className={`flex items-center gap-2 border rounded px-2.5 py-1.5 text-[10px] transition-colors ${owned ? "border-lime-900/50 bg-lime-900/10" : "border-yellow-900/50 bg-black/30 hover:border-yellow-700/50"}`}>
                            <span className="h-4 w-4 rounded block shrink-0" style={{ background: `#${CAMO_COLORS[c.type].toString(16).padStart(6, "0")}` }} />
                            <span className={owned ? "text-lime-400" : "text-lime-200/60"}>{c.label}</span>
                            {!owned && <span className="text-yellow-500">{c.goldCost}\uD83E\uDE99</span>}
                            {owned && <span className="text-lime-400">\u2713</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tank unlocks */}
                  <div className="mt-5 border-t border-lime-900/50 pt-4">
                    <span className="ui-kicker">Открытие техники</span>
                    <div className="mt-3 space-y-1.5">
                      {TANK_UNLOCKS.filter((u) => u.xpCost > 0).map((u) => {
                        const unlocked = progress.unlockedTanks.includes(u.model);
                        return (
                          <div key={u.model} className="flex items-center justify-between mono text-[10px] border-b border-lime-900/30 pb-1.5">
                            <span className={unlocked ? "text-lime-300" : "text-zinc-500"}>{unlocked ? "\u2713" : "\u{1F512}"} {u.name}</span>
                            <span className={unlocked ? "text-lime-400" : "text-yellow-600"}>{unlocked ? "Открыт" : `${u.xpCost} XP`}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
