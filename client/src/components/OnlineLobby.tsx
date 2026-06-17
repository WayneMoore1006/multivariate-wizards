// client/src/components/OnlineLobby.tsx
// Owns the socket lifecycle + room state for online 1v1. Once the server moves
// the room into a battle phase, it renders <Battle> in online mode *inside*
// itself so the socket bridge stays alive across the whole match.
import { useEffect, useRef, useState } from "react";
import type { GameSettings, WizardKind, RoomState, GameOverPayload } from "@shared/types";
import { getSocket, bridgeOnline, helpers } from "../net/socket";
import { WizardPicker, wizardMeta } from "./ui";
import Battle, { type MatchResult, type SidePlayer } from "./Battle";

type View = "choose" | "create" | "join" | "room";

export default function OnlineLobby(props: {
  nickname: string;
  wizard: WizardKind;
  settings: GameSettings;
  onWizard: (k: WizardKind) => void;
  onResult: (r: MatchResult) => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<View>("choose");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const myId = useRef<string>("");

  // wire the bridge once
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => { myId.current = s.id ?? ""; };
    s.on("connect", onConnect);
    if (s.connected) myId.current = s.id ?? "";

    const detach = bridgeOnline(
      () => myId.current,
      (r) => setRoom(r),
      (g: GameOverPayload) => props.onResult(buildResult(g, myId.current))
    );

    const offDisc = () => setDisconnected(true);
    s.on("opponentDisconnected", offDisc);

    return () => {
      detach();
      s.off("connect", onConnect);
      s.off("opponentDisconnected", offDisc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setError("");
    const c = await helpers.createRoom(props.nickname, props.wizard, props.settings);
    myId.current = getSocket().id ?? "";
    setCode(c);
    setView("room");
  };

  const join = async () => {
    setError("");
    const res = await helpers.joinRoom(joinCode.trim().toUpperCase(), props.nickname, props.wizard);
    if (!res.ok) { setError(res.error || "Could not join that room."); return; }
    myId.current = getSocket().id ?? "";
    setCode(joinCode.trim().toUpperCase());
    setRoom(res.room ?? null);
    setView("room");
  };

  const leave = () => { if (code) helpers.leave(code); props.onBack(); };

  // --- in a battle phase: render the duel ---------------------------------
  const inBattle = room && room.phase !== "lobby";
  if (inBattle && room) {
    const me = room.players.find((p) => p.id === myId.current) ?? room.players[0];
    const opp = room.players.find((p) => p.id !== myId.current) ?? room.players[1];
    return (
      <Battle
        meName={me?.nickname ?? props.nickname}
        meWizard={(me?.wizard ?? props.wizard) as WizardKind}
        oppName={opp?.nickname ?? "Opponent"}
        oppWizard={(opp?.wizard ?? "dark") as WizardKind}
        settings={room.settings}
        roomCode={code}
        onGameOver={() => { /* online result arrives via bridge → onResult */ }}
        onQuit={leave}
      />
    );
  }

  // --- choose create / join ------------------------------------------------
  if (view === "choose") {
    return (
      <div className="form-wrap float-in">
        <div className="row between" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 26 }}>Online 1v1</h2>
          <button className="btn btn-ghost btn-sm" onClick={props.onBack}>← Back</button>
        </div>
        <div className="panel form-card stack" style={{ gap: 14 }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Host a duel and share the six-letter code, or join a friend's room. You'll
            need both tabs/devices pointed at the same server.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => { setView("create"); create(); }}>
            Host a duel
          </button>
          <button className="btn btn-gold btn-block" onClick={() => setView("join")}>
            Join with a code
          </button>
        </div>
      </div>
    );
  }

  if (view === "join") {
    return (
      <div className="form-wrap float-in">
        <div className="row between" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 26 }}>Join a duel</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setView("choose")}>← Back</button>
        </div>
        <div className="panel form-card stack" style={{ gap: 16 }}>
          <div className="field">
            <label>Room code</label>
            <input
              className="input code-input"
              maxLength={6}
              placeholder="ABCDEF"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
          </div>
          {error && <p className="err-text">{error}</p>}
          <button className="btn btn-primary btn-block" onClick={join} disabled={joinCode.trim().length < 4}>
            Enter the arena
          </button>
        </div>
      </div>
    );
  }

  // --- room (waiting) ------------------------------------------------------
  const me = room?.players.find((p) => p.id === myId.current);
  const opp = room?.players.find((p) => p.id !== myId.current);
  const bothHere = (room?.players.length ?? 0) >= 2;

  return (
    <div className="form-wrap float-in">
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 26 }}>Duel Room</h2>
        <button className="btn btn-ghost btn-sm" onClick={leave}>Leave</button>
      </div>

      <div className="panel form-card stack" style={{ gap: 18 }}>
        <div className="code-banner">
          <span className="eyebrow">Room code</span>
          <div className="code-big">{code || "······"}</div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigator.clipboard?.writeText(code)}
          >Copy</button>
        </div>

        {disconnected && <p className="err-text">Your opponent left the arena.</p>}

        <div className="versus">
          <PlayerSlot label="You" name={me?.nickname ?? props.nickname} wizard={(me?.wizard ?? props.wizard) as WizardKind} ready={me?.ready} />
          <div className="vs">VS</div>
          <PlayerSlot
            label="Challenger"
            name={opp?.nickname}
            wizard={opp?.wizard as WizardKind | undefined}
            ready={opp?.ready}
            waiting={!opp}
          />
        </div>

        {!bothHere && (
          <p className="muted center" style={{ textAlign: "center" }}>
            Waiting for a challenger to enter the code…
          </p>
        )}

        <div className="field">
          <label>Switch school · 選擇巫師</label>
          <WizardPicker
            value={(me?.wizard ?? props.wizard) as WizardKind}
            onChange={(k) => {
              props.onWizard(k);
              if (code) helpers.updateWizard(code, k); // sync to server so opponent sees it
            }}
          />
        </div>

        <button
          className={"btn btn-block " + (me?.ready ? "btn-ghost" : "btn-primary")}
          disabled={!bothHere}
          onClick={() => helpers.ready(code, !me?.ready, (me?.wizard ?? props.wizard) as WizardKind)}
        >
          {me?.ready ? "Cancel ready" : "Ready"}
        </button>
        <p className="faint center" style={{ textAlign: "center", fontSize: 12 }}>
          The duel begins automatically once both wizards are ready.
        </p>
      </div>
    </div>
  );
}

function PlayerSlot(props: {
  label: string; name?: string; wizard?: WizardKind; ready?: boolean; waiting?: boolean;
}) {
  const meta = props.wizard ? wizardMeta(props.wizard) : null;
  return (
    <div className={"player-slot" + (props.ready ? " ready" : "")}>
      <span className="eyebrow">{props.label}</span>
      <div className={"wizard-orb " + (meta?.orb ?? "orb-dark")} style={{ opacity: props.waiting ? 0.25 : 1 }} />
      <div className="wizard-name">{props.waiting ? "—" : props.name || "…"}</div>
      <div className="faint">{props.waiting ? "waiting" : meta?.element}</div>
      {props.ready && <span className="chip teal" style={{ marginTop: 6 }}>ready</span>}
    </div>
  );
}

function buildResult(g: GameOverPayload, myId: string): MatchResult {
  const meId = myId;
  const oppId = g.players.find((p) => p.id !== meId)?.id ?? "";
  const meP = g.players.find((p) => p.id === meId);
  const oppP = g.players.find((p) => p.id === oppId);
  const meS = g.perPlayerStats[meId];
  const oppS = g.perPlayerStats[oppId];
  const side = (name: string, s?: typeof meS): SidePlayer => ({
    name,
    correct: s?.correct ?? 0,
    total: s?.total ?? 0,
    accuracy: s?.accuracy ?? 0,
    avgMs: s?.avgAnswerMs ?? 0,
    fastestMs: s?.fastestMs ?? null,
    totalDamage: s?.totalDamage ?? 0,
    wrong: (s?.wrongQuestions ?? []).map((w) => ({ questionEn: w.questionEn, correctAnswers: w.correctAnswers, your: w.your })),
  });
  return {
    meWon: g.winnerId === null ? null : g.winnerId === meId,
    me: side(meP?.nickname ?? "You", meS),
    opp: side(oppP?.nickname ?? "Opponent", oppS),
  };
}
