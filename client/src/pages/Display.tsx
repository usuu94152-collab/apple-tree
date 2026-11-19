import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Artwork } from "../../../shared/protocol";
import { socket, request } from "../network/socket";
import { World } from "../game/World";
import { setSound, soundEnabled } from "../game/sound";
import {
  musicEnabled,
  setMusic,
  setTune,
  startMusic,
  stopMusic,
} from "../game/music";
import { StageId, stageIds, stageNames } from "../three/stage";
function savedStage(): StageId {
  const q = new URLSearchParams(location.search).get("stage");
  if (stageIds.includes(q as StageId)) return q as StageId;
  try {
    const s = localStorage.getItem("swoosh-stage");
    if (stageIds.includes(s as StageId)) return s as StageId;
  } catch {
    /* Default place. */
  }
  return "station";
}
export function Display() {
  const [room, setRoom] = useState(""),
    [qr, setQR] = useState(""),
    [error, setError] = useState("놀이터를 준비하고 있어요…"),
    [initial, setInitial] = useState<Artwork[] | null>(null),
    [menu, setMenu] = useState(false),
    [count, setCount] = useState(0),
    [sound, setAudio] = useState(soundEnabled()),
    [closed, setClosed] = useState(false),
    [connected, setConnected] = useState(false),
    [showCode, setShowCode] = useState(false),
    [stage, setStage] = useState<StageId>(savedStage),
    [music, setMusicOn] = useState(musicEnabled());
  // Each place has its own tune; music starts with the first tap (browser rule).
  useEffect(() => setTune(stage), [stage]);
  useEffect(() => {
    const go = () => startMusic();
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      stopMusic();
    };
  }, []);
  // Everything the big screen has received, so switching places keeps the friends.
  const seen = useRef<Artwork[]>([]);
  const current = useRef(stage);
  /** Show another place, keeping every friend who already arrived. */
  const switchTo = (id: StageId) => {
    if (id === current.current) return;
    current.current = id;
    try {
      localStorage.setItem("swoosh-stage", id);
    } catch {
      /* Choice lasts for this visit. */
    }
    setInitial((was) => (was ? [...seen.current] : was));
    setStage(id);
  };
  useEffect(() => {
    let active = true;
    const connect = async () => {
      setConnected(true);
      try {
        const stored = sessionStorage.getItem("display-room");
        const r = await request(
          stored ? "resume-display" : "create-room",
          stored ? JSON.parse(stored) : {},
        );
        if (!active) return;
        if (!r.ok) {
          setError(r.error!);
          sessionStorage.removeItem("display-room");
          setClosed(true);
          return;
        }
        setRoom(r.roomId!);
        sessionStorage.setItem(
          "display-room",
          JSON.stringify({ roomId: r.roomId, token: r.token }),
        );
        seen.current = [...(r.artworks || [])];
        setInitial(r.artworks || []);
        // A place picked from a tablet wins; otherwise tell the room ours.
        if (r.stage) switchTo(r.stage);
        else
          void request("set-stage", { stage: current.current }).catch(() => {});
        setError("");
        setQR(
          await QRCode.toDataURL(`${location.origin}/draw?room=${r.roomId}`, {
            width: 200,
            margin: 1,
            color: { dark: "#36555b", light: "#ffffff" },
          }),
        );
      } catch {
        setError("연결을 확인한 뒤 새로고침해 주세요.");
      }
    };
    const disconnect = () => setConnected(false);
    const participants = (p: { count: number }) => setCount(p.count);
    const end = () => {
      setClosed(true);
      setInitial(null);
      sessionStorage.removeItem("display-room");
      setError("놀이방이 종료되었어요.");
    };
    const remember = (a: Artwork) => {
      if (!seen.current.some((x) => x.messageId === a.messageId))
        seen.current = [...seen.current, a].slice(-30);
    };
    const forget = () => (seen.current = []);
    const picked = (p: { stage: StageId }) => {
      if (stageIds.includes(p?.stage)) switchTo(p.stage);
    };
    socket
      .on("connect", connect)
      .on("disconnect", disconnect)
      .on("participants", participants)
      .on("room-closed", end)
      .on("artwork", remember)
      .on("stage", picked)
      .on("reset", forget);
    socket.connect();
    return () => {
      active = false;
      socket
        .off("connect", connect)
        .off("disconnect", disconnect)
        .off("participants", participants)
        .off("room-closed", end)
        .off("artwork", remember)
        .off("stage", picked)
        .off("reset", forget);
      socket.disconnect();
    };
  }, []);
  async function control(event: string) {
    if (
      !confirm(
        event === "reset-room"
          ? "놀이터의 그림을 모두 지울까요?"
          : "놀이방을 종료할까요?",
      )
    )
      return;
    try {
      const r = await request(event, {});
      if (!r.ok) setError(r.error!);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="display-page">
      {initial && (
        <World key={stage} initial={initial} stage={stage} zoomable />
      )}
      <div className="zoom-bar" role="group" aria-label="화면 확대">
        {(
          [
            ["in", "＋", "확대"],
            ["out", "－", "축소"],
            ["reset", "⤢", "전체 보기"],
          ] as const
        ).map(([what, icon, label]) => (
          <button
            key={what}
            aria-label={label}
            title={label}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("world-zoom", { detail: what }),
              )
            }
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="stage-bar" role="group" aria-label="장소 고르기">
        {stageIds.map((id) => (
          <button
            key={id}
            aria-pressed={stage === id}
            className={stage === id ? "on" : ""}
            onClick={() => {
              switchTo(id);
              void request("set-stage", { stage: id }).catch(() => {});
            }}
          >
            {stageNames[id]}
          </button>
        ))}
      </div>
      <a className="display-brand brand" href="/">
        <span className="brand-brick" aria-hidden="true" />
        슝슝 <span>블록 기차역</span>
      </a>
      <button
        className="parent-toggle"
        aria-label="보호자 설정"
        onClick={() => {
          setMenu(!menu);
          setSound(sound);
        }}
      >
        ⚙
      </button>
      {menu && (
        <section className="parent-menu">
          <strong>보호자 설정</strong>
          <button
            onClick={() =>
              void document.documentElement
                .requestFullscreen?.()
                .catch(() =>
                  setError("이 브라우저에서는 전체 화면을 지원하지 않아요."),
                )
            }
          >
            ⛶ 전체 화면
          </button>
          <button
            onClick={() => {
              setAudio(!sound);
              setSound(!sound);
            }}
          >
            {sound ? "🔊" : "🔇"} 효과음 {sound ? "끄기" : "켜기"}
          </button>
          <button onClick={() => setShowCode(!showCode)}>
            ▦ 방 코드 {room}
          </button>
          <button onClick={() => void control("reset-room")}>
            ↶ 기차역 비우기
          </button>
          <button onClick={() => void control("close-room")}>
            놀이방 종료
          </button>
        </section>
      )}
      {room && !closed && (
        <section
          className={"room-panel " + (count > 0 && !showCode ? "compact" : "")}
        >
          <div className="eyebrow">🚉 슝슝역 승차권</div>
          {count === 0 || showCode ? (
            <>
              <h1>
                블록 친구를 꾸며서
                <br />
                기차역으로, 슝!
              </h1>
              <p>
                태블릿으로 QR 코드를 찍거나
                <br />
                꾸미기 화면에서 코드를 입력해요.
              </p>
              {qr && <img src={qr} alt="태블릿 연결 QR 코드" />}
              <div className="room-code" aria-label="놀이방 코드">
                {room}
              </div>
              <small>서로 다른 곳에서도 같은 주소로 만나요.</small>
            </>
          ) : (
            <button onClick={() => setShowCode(true)}>
              🎫 {count}명과 함께 노는 중 · {room}
            </button>
          )}
        </section>
      )}
      {(error || !connected) && (
        <div className="display-alert" role="status">
          {!connected ? "연결을 다시 기다리고 있어요." : error}
          {closed && (
            <button onClick={() => location.reload()}>새 놀이방 만들기</button>
          )}
        </div>
      )}
      <div className="display-bottom">
        {count > 0
          ? "친구나 기차를 톡! 눌러 보세요 🚂"
          : "블록 친구를 꾸며서 날려 보내면 기차역에 도착해요 🚂"}
        <button
          onClick={() => {
            setAudio(!sound);
            setSound(!sound);
          }}
        >
          {sound ? "🔊 소리 켜짐 · 눌러 활성화" : "🔇 소리 꺼짐"}
        </button>
        <button
          onClick={() => {
            setMusicOn(!music);
            setMusic(!music);
          }}
        >
          {music ? "🎵 음악 켜짐" : "🎵 음악 꺼짐"}
        </button>
      </div>
    </main>
  );
}
