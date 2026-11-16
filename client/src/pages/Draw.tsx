import { useEffect, useRef, useState } from "react";
import { Artwork } from "../../../shared/protocol";
import {
  Design,
  FaceId,
  HatId,
  ItemId,
  Region,
  colors,
  defaultDesign,
  faces,
  hats,
  items,
  svgUrl,
  thumbSvg,
} from "../objects/figure";
import {
  DrawingCanvas,
  DrawingHandle,
  Tool,
} from "../components/DrawingCanvas";
import { socket, request } from "../network/socket";
import { play, setSound, soundEnabled } from "../game/sound";
type Tab = "hat" | "face" | "item";
type Step = "stroke" | Design;
const tabs: [Tab, string, string][] = [
  ["hat", "🎩", "모자"],
  ["face", "😊", "표정"],
  ["item", "🎈", "소품"],
];
const choices = {
  hat: Object.entries(hats).map(([id, h]) => [id, h.name]),
  face: Object.entries(faces).map(([id, f]) => [id, f.name]),
  item: Object.entries(items).map(([id, i]) => [id, i.name]),
} as Record<Tab, [string, string][]>;
const thumbs = Object.fromEntries(
  (["hat", "face", "item"] as Tab[]).flatMap((t) =>
    choices[t].map(([id]) => [t + id, svgUrl(thumbSvg(t, id))]),
  ),
);
const designKey = (room: string) => `swoosh-design-${room}`;
function loadDesign(room: string): Design {
  try {
    const d = JSON.parse(localStorage.getItem(designKey(room)) || "null");
    if (d && d.hat in hats && d.face in faces && d.item in items) return d;
  } catch {
    /* Fall back to a fresh friend. */
  }
  return defaultDesign();
}
export function Draw() {
  const [code, setCode] = useState(
      new URLSearchParams(location.search).get("room") ||
        sessionStorage.getItem("draw-room") ||
        "",
    ),
    [joined, setJoined] = useState(false),
    [connected, setConnected] = useState(false),
    [status, setStatus] = useState("큰 화면의 방 코드를 입력해 주세요."),
    [design, setDesignState] = useState<Design>(() => loadDesign(code)),
    [tab, setTab] = useState<Tab>("hat"),
    [tool, setTool] = useState<Tool>("fill"),
    [color, setColor] = useState(colors[0][1]),
    [width, setWidth] = useState(14),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(!soundEnabled()),
    [success, setSuccess] = useState(false);
  const drawing = useRef<DrawingHandle>(null),
    pending = useRef<Artwork | null>(null),
    history = useRef<Step[]>([]),
    locked = useRef(false),
    waiter = useRef<((id: string) => void) | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const room = useRef(code);
  useEffect(() => {
    room.current = code;
  }, [code]);
  const setDesign = (next: Design, remember = true) => {
    if (remember) history.current.push(design);
    setDesignState(next);
    try {
      localStorage.setItem(designKey(room.current), JSON.stringify(next));
    } catch {
      /* Current design remains in memory. */
    }
  };
  useEffect(() => {
    const join = async () => {
      setConnected(true);
      if (!/^\d{6}$/.test(room.current)) return;
      try {
        const r = await request("join-room", { roomId: room.current });
        setJoined(r.ok);
        if (r.ok) {
          sessionStorage.setItem("draw-room", room.current);
          setStatus("연결됐어요! 블록 친구를 꾸며 보세요.");
        } else setStatus(r.error!);
      } catch {
        setStatus("연결을 다시 시도해 주세요.");
      }
    };
    const off = () => {
      setConnected(false);
      setStatus("연결이 잠시 끊겼어요. 꾸민 친구는 그대로 있어요.");
    };
    const closed = () => {
      pending.current = null;
      setJoined(false);
      setStatus("놀이방이 종료되었어요. 새 방 코드를 입력해 주세요.");
      socket.disconnect();
      socket.connect();
    };
    const shown = (p: { messageId: string }) => waiter.current?.(p.messageId);
    const displayOff = () =>
      setStatus("큰 화면이 다시 연결되기를 기다리고 있어요.");
    socket
      .on("connect", join)
      .on("disconnect", off)
      .on("room-closed", closed)
      .on("artwork-displayed", shown)
      .on("display-offline", displayOff);
    socket.connect();
    return () => {
      socket
        .off("connect", join)
        .off("disconnect", off)
        .off("room-closed", closed)
        .off("artwork-displayed", shown)
        .off("display-offline", displayOff);
      socket.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  async function launch() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    play("launch");
    setStatus("슝! 블록 친구가 날아가고 있어요…");
    try {
      drawing.current?.save();
      pending.current ??= {
        messageId:
          crypto.randomUUID?.() ||
          Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(""),
        roomId: code,
        objectType: "figure",
        imageData: await drawing.current!.compose(),
        design,
        timestamp: Date.now(),
      };
      const a = pending.current;
      let resolveShown: (id: string) => void = () => {};
      const shown = new Promise<void>((resolve) => {
        resolveShown = (id) => {
          if (id === a.messageId) resolve();
        };
        waiter.current = resolveShown;
      });
      const r = await request("send-artwork", a);
      if (!r.ok) throw Error(r.error);
      setStatus("서버가 받았어요. 기차역에 도착하기를 기다려요…");
      if (!r.displayed)
        await Promise.race([
          shown,
          new Promise((_, reject) => {
            timer.current = setTimeout(
              () =>
                reject(
                  Error(
                    "서버가 받았지만 기차역 도착은 아직 확인되지 않았어요.",
                  ),
                ),
              9000,
            );
          }),
        ]);
      clearTimeout(timer.current);
      play("bell");
      setSuccess(true);
      setStatus("짜잔! 역에 도착했어요. 열차를 기다려요 🚆");
      drawing.current!.clear();
      history.current = [];
      setDesign(defaultDesign(), false);
      pending.current = null;
      setReady(false);
      timer.current = setTimeout(() => setSuccess(false), 1200);
    } catch (e) {
      setStatus(
        (e as Error).message +
          (pending.current ? " 준비되면 다시 위로 휙 밀어 주세요." : ""),
      );
    } finally {
      waiter.current = null;
      locked.current = false;
      setBusy(false);
    }
  }
  async function joinManual() {
    room.current = code;
    try {
      const r = await request("join-room", { roomId: code });
      if (!r.ok) throw Error(r.error);
      if (pending.current?.roomId !== code) pending.current = null;
      sessionStorage.setItem("draw-room", code);
      setDesignState(loadDesign(code));
      setJoined(true);
      setStatus("연결됐어요! 블록 친구를 꾸며 보세요.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  const locked_ = busy || !!pending.current;
  function choose(t: Tab, id: string) {
    const next = { ...design, fills: { ...design.fills } };
    if (t === "hat") {
      next.hat = id as HatId;
      delete next.fills.hat;
      delete next.fills.hatTrim;
    } else if (t === "item") {
      next.item = id as ItemId;
      delete next.fills.item;
      delete next.fills.itemTrim;
    } else next.face = id as FaceId;
    setDesign(next);
    setReady(false);
    play();
  }
  function fill(r: Region) {
    if (design.fills[r] === color) return;
    setDesign({ ...design, fills: { ...design.fills, [r]: color } });
    play("fill");
  }
  function undo() {
    const step = history.current.pop();
    if (!step) return;
    if (step === "stroke") drawing.current?.undo();
    else setDesign(step, false);
  }
  const toolButton = (t: Tool, icon: string, label: string) => (
    <button
      aria-label={label}
      aria-pressed={tool === t}
      className={tool === t ? "on" : ""}
      disabled={locked_}
      onClick={() => {
        setTool(t);
        setReady(false);
        play();
      }}
    >
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
  return (
    <main className="draw-page">
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-brick" aria-hidden="true" />
          슝슝 <span>블록 기차역</span>
        </a>
        <div className="room-status">
          <i className={connected ? "online" : ""} />
          {joined ? `놀이방 ${code}` : "함께 놀아요"}
        </div>
        <button
          className="sound-toggle"
          aria-label="효과음 전환"
          onClick={() => {
            setMuted(!muted);
            setSound(muted);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>
      {!joined ? (
        <section className="join-card">
          <div className="join-train" aria-hidden="true">
            🚂
          </div>
          <h1>어느 기차역으로 갈까요?</h1>
          <p>
            PC나 TV에서 <a href="/display">큰 화면</a>을 열고
            <br />
            보이는 6자리 코드를 입력해 주세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void joinManual();
            }}
          >
            <input
              aria-label="방 코드"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
            <button
              className="brick-button primary"
              disabled={!connected || code.length !== 6}
            >
              출발! →
            </button>
          </form>
          <p role="status">{status}</p>
        </section>
      ) : (
        <div className={"studio " + (success ? "launched" : "")}>
          <h1 className="studio-title">
            나만의 <b>블록 친구</b>를 꾸며요!
          </h1>
          <section className="dress-up" aria-label="꾸미기">
            <div className="dress-tabs" role="tablist">
              {tabs.map(([t, icon, label]) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "on" : ""}
                  onClick={() => setTab(t)}
                >
                  <span aria-hidden="true">{icon}</span> {label}
                </button>
              ))}
            </div>
            <div className="dress-options">
              {choices[tab].map(([id, name]) => {
                const on = design[tab] === id;
                return (
                  <button
                    key={id}
                    aria-label={name}
                    aria-pressed={on}
                    className={on ? "on" : ""}
                    disabled={locked_}
                    onClick={() => choose(tab, id)}
                  >
                    {id === "none" ? (
                      <span className="none-mark">✕</span>
                    ) : (
                      <img src={thumbs[tab + id]} alt="" />
                    )}
                    <small>{name}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="tool-panel">
            {toolButton("fill", "🪣", "색칠하기")}
            {toolButton("pen", "✏️", "그리기")}
            {toolButton("erase", "🧽", "지우개")}
            <button
              aria-label="펜 굵기 변경"
              disabled={locked_ || tool === "fill"}
              aria-pressed={width === 28}
              onClick={() => setWidth(width === 14 ? 28 : 14)}
            >
              <span>{width === 14 ? "●" : "⬤"}</span>
              <small>{width === 14 ? "가는 펜" : "굵은 펜"}</small>
            </button>
            <button aria-label="실행 취소" disabled={locked_} onClick={undo}>
              <span>↶</span>
              <small>되돌리기</small>
            </button>
            <button
              className="clear-tool"
              disabled={locked_}
              aria-label="전체 지우기"
              onClick={() => {
                if (!confirm("처음부터 다시 꾸밀까요?")) return;
                drawing.current?.clear();
                history.current = [];
                setDesign(defaultDesign(), false);
              }}
            >
              <span>♻️</span>
              <small>처음부터</small>
            </button>
          </aside>
          <div className="canvas-area" inert={busy}>
            {success && (
              <div className="launch-confetti" aria-hidden="true">
                ✦　✧　✦
                <br />
                　✳　✧
              </div>
            )}
            <DrawingCanvas
              ref={drawing}
              design={design}
              tool={tool}
              color={color}
              width={width}
              ready={ready || !!pending.current}
              flying={busy}
              canCancel={!pending.current}
              onSwipe={() => void launch()}
              onCancel={() => setReady(false)}
              onFill={fill}
              onStroke={() => history.current.push("stroke")}
              roomId={code}
            />
          </div>
          <p className="tool-tip">
            {ready || pending.current
              ? "🚀 도화지를 위로 휙! 밀면 기차역으로 날아가요"
              : tool === "fill"
                ? "🪣 색을 고르고 옷 · 모자 · 다리를 톡! 눌러 칠해요"
                : "✏️ 손가락으로 무늬를 그려요. 친구 밖은 칠해지지 않아요"}
          </p>
          <div className="color-palette" aria-label="색상">
            {colors.map(([name, c]) => (
              <button
                key={c}
                aria-label={name}
                aria-pressed={color === c}
                className={color === c ? "chosen" : ""}
                style={{ background: c }}
                disabled={locked_}
                onClick={() => {
                  setColor(c);
                  if (tool === "erase") setTool("pen");
                  play();
                }}
              />
            ))}
          </div>
          <div className="launch-row">
            <button
              className={"brick-button " + (ready ? "soft" : "primary")}
              disabled={locked_}
              onClick={() => {
                setReady(!ready);
                play();
              }}
            >
              {ready ? "↩ 더 꾸미기" : "✓ 다 만들었어요"}
            </button>
          </div>
          <p className="draw-status" role="status">
            {status}
          </p>
        </div>
      )}
    </main>
  );
}
