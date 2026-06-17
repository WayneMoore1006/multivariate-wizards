// client/src/App.tsx
import { useState } from "react";
import type { GameSettings, WizardKind, LanguageMode } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
import { audio } from "./game/systems/AudioManager";
import MainMenu from "./components/MainMenu";
import SettingsPanel from "./components/SettingsPanel";
import OnlineLobby from "./components/OnlineLobby";
import QuestionStats from "./components/QuestionStats";
import QuestionGallery from "./components/QuestionGallery";
import BotBattle from "./components/BotBattle";
import Result from "./components/Result";
import type { MatchResult } from "./components/Battle";

type Screen = "menu" | "settings" | "stats" | "gallery" | "bot" | "online" | "result";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [nickname, setNickname] = useState("Archmage");
  const [wizard, setWizard] = useState<WizardKind>("fire");
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [uiLang, setUiLang] = useState<LanguageMode>(DEFAULT_SETTINGS.languageMode);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [lastMode, setLastMode] = useState<"bot" | "online">("bot");

  const go = (s: Screen) => {
    audio.unlock();
    if (s === "menu" || s === "settings" || s === "stats" || s === "online" || s === "gallery") audio.bgm("lobby");
    else if (s === "result") audio.stopBgm();
    setScreen(s);
  };

  const startBot = () => { setLastMode("bot"); go("bot"); };
  const startOnline = () => { setLastMode("online"); go("online"); };

  const onResult = (r: MatchResult) => { setResult(r); setScreen("result"); };

  return (
    <div className="app-shell">
      {screen === "menu" && (
        <MainMenu
          nickname={nickname}
          wizard={wizard}
          uiLang={uiLang}
          onUiLang={setUiLang}
          onNickname={setNickname}
          onWizard={setWizard}
          onPlayBot={startBot}
          onPlayOnline={startOnline}
          onSettings={() => go("settings")}
          onStats={() => go("stats")}
          onGallery={() => go("gallery")}
        />
      )}

      {screen === "settings" && (
        <SettingsPanel settings={settings} onChange={setSettings} onBack={() => go("menu")} />
      )}

      {screen === "stats" && <QuestionStats onBack={() => go("menu")} />}

      {screen === "gallery" && <QuestionGallery uiLang={uiLang} onBack={() => go("menu")} />}

      {screen === "bot" && (
        <BotBattle
          nickname={nickname || "You"}
          wizard={wizard}
          settings={settings}
          onResult={onResult}
          onQuit={() => go("menu")}
        />
      )}

      {screen === "online" && (
        <OnlineLobby
          nickname={nickname || "You"}
          wizard={wizard}
          settings={settings}
          onWizard={setWizard}
          onResult={onResult}
          onBack={() => go("menu")}
        />
      )}

      {screen === "result" && result && (
        <Result
          result={result}
          onRematch={() => go(lastMode)}
          onMenu={() => go("menu")}
        />
      )}
    </div>
  );
}
