import { useState } from "react";
import type { GameSettings } from "./types";
import Menu from "./components/Menu";
import GameView from "./components/GameView";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [runId, setRunId] = useState(0);

  const startGame = (s: GameSettings) => {
    setSettings(s);
    setRunId((n) => n + 1);
    setScreen("game");
  };

  if (screen === "game" && settings) {
    return (
      <GameView
        key={runId}
        settings={settings}
        onExit={() => setScreen("menu")}
        onRestart={() => setRunId((n) => n + 1)}
      />
    );
  }

  return <Menu onStart={startGame} />;
}
