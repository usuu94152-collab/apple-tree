import { useEffect, useRef, useState } from "react";
import { Artwork, ObjectType, objectTypes } from "../../../shared/protocol";
import { objects, svg, svgUrl } from "../objects/catalog";
import { DrawingCanvas, DrawingHandle } from "../components/DrawingCanvas";
import { socket, request } from "../network/socket";
import { play, setSound, soundEnabled } from "../game/sound";
const colors = [
  ["빨강", "#f46b68"],
  ["주황", "#f5a453"],
  ["노랑", "#f4ce58"],
  ["초록", "#79b883"],
  ["파랑", "#6caee5"],
  ["보라", "#aa8ed3"],
  ["분홍", "#ed9db6"],
  ["검정", "#364e55"],
];
export function Draw() {
  const [code, setCode] = useState(
      new URLSearchParams(location.search).get("room") ||
        sessionStorage.getItem("draw-room") ||
        "",
    ),
    [joined, setJoined] = useState(false),
    [connected, setConnected] = useState(false),
    [status, setStatus] = useState("큰 화면의 방 코드를 입력해 주세요."),
    [type, setType] = useState<ObjectType>("apple"),
    [color, setColor] = useState(colors[0][1]),
    [width, setWidth] = useState(24),
    [erase, setErase] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [muted, setMuted] = useState(!soundEnabled()),
    [success, setSuccess] = useState(false);
  const drawing = useRef<DrawingHandle>(null),
    pending = useRef<Artwork | null>(null),
    locked = useRef(false),
    waiter = useRef<((id: string) => void) | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const room = useRef(code);
  useEffect(() => {
    room.current = code;
  }, [code]);
  useEffect(() => {
    const join = async () => {
      setConnected(true);
      if (!/^\d{6}$/.test(room.current)) return;
      try {
        const r = await request("join-room", { roomId: room.current });
        setJoined(r.ok);
        if (r.ok) {
          sessionStorage.setItem("draw-room", room.current);
          setStatus("연결됐어요! 마음껏 그려 보세요.");
        } else setStatus(r.error!);
      } catch {
        setStatus("연결을 다시 시도해 주세요.");
      }
    };
    const off = () => {
      setConnected(false);
      setStatus("연결이 잠시 끊겼어요. 그림은 그대로 있어요.");
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
    setStatus("슝! 그림이 날아가고 있어요…");
    try {
      drawing.current?.save();
      pending.current ??= {
        messageId:
          crypto.randomUUID?.() ||
          Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join(""),
        roomId: code,
        objectType: type,
        imageData: await drawing.current!.compose(),
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
      setStatus("서버가 받았어요. 큰 화면에 나타나기를 기다려요…");
      if (!r.displayed)
        await Promise.race([
          shown,
          new Promise((_, reject) => {
            timer.current = setTimeout(
              () =>
                reject(
                  Error("서버가 받았지만 화면 표시는 아직 확인되지 않았어요."),
                ),
              9000,
            );
          }),
        ]);
      clearTimeout(timer.current);
      play("star");
      setSuccess(true);
      setStatus("짜잔! 큰 화면에서 만나요 ✨");
      drawing.current!.clear();
      pending.current = null;
      setReady(false);
      timer.current = setTimeout(() => setSuccess(false), 1000);
    } catch (e) {
      setStatus(
        (e as Error).message +
          (pending.current ? " 준비되면 그림을 다시 위로 밀어 주세요." : ""),
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
      setJoined(true);
      setStatus("연결됐어요! 마음껏 그려 보세요.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <main className="draw-page">
      <header className="app-header">
        <a className="brand" href="/">
          ✳ 슝슝 <span>그림 놀이터</span>
        </a>
        <div className="room-status">
          <i className={connected ? "online" : ""} />
          {joined ? `놀이방 ${code}` : "함께 그려요"}
        </div>
        <button
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
          <div className="big-icon">🎨</div>
          <h1>어느 놀이터로 갈까요?</h1>
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
              className="primary"
              disabled={!connected || code.length !== 6}
            >
              놀러 가기 →
            </button>
          </form>
          <p role="status">{status}</p>
        </section>
      ) : (
        <>
          <div className="draw-heading">
            <span className="eyebrow">LITTLE ARTIST, BIG IMAGINATION</span>
            <h1>어떤 친구를 꾸며 볼까요?</h1>
          </div>
          <div className="object-selector">
            {objectTypes.map((t) => (
              <button
                key={t}
                aria-label={objects[t].name}
                aria-pressed={type === t}
                disabled={busy || !!pending.current}
                className={type === t ? "selected" : ""}
                onClick={() => {
                  setType(t);
                  setReady(false);
                  play();
                }}
              >
                <img
                  src={svgUrl(
                    svg(
                      t,
                      {
                        apple: "#f9a09b",
                        fish: "#9dd5de",
                        balloon: "#bda6e4",
                        star: "#ffe199",
                      }[t],
                    ),
                  )}
                  alt=""
                />
                <span>{objects[t].name}</span>
              </button>
            ))}
          </div>
          <div className={"draw-workspace " + (success ? "launched" : "")}>
            <aside className="tool-panel">
              <button
                aria-label="실행 취소"
                disabled={busy || !!pending.current}
                onClick={() => drawing.current?.undo()}
              >
                ↶<small>되돌리기</small>
              </button>
              <button
                aria-label="펜 굵기 변경"
                disabled={busy || !!pending.current}
                aria-pressed={width === 44}
                onClick={() => setWidth(width === 24 ? 44 : 24)}
              >
                {width === 24 ? "●" : "⬤"}
                <small>{width === 24 ? "기본 펜" : "굵은 펜"}</small>
              </button>
              <button
                aria-label="지우개"
                disabled={busy || !!pending.current}
                aria-pressed={erase}
                onClick={() => setErase(!erase)}
              >
                ▱<small>지우개</small>
              </button>
              <button
                className="clear-tool"
                disabled={busy || !!pending.current}
                aria-label="전체 지우기"
                onClick={() => {
                  if (confirm("그림을 모두 지울까요?"))
                    drawing.current?.clear();
                }}
              >
                ♧<small>모두 지우기</small>
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
                type={type}
                color={color}
                width={width}
                erase={erase}
                ready={ready || !!pending.current}
                flying={busy}
                canCancel={!pending.current}
                onSwipe={() => void launch()}
                onCancel={() => setReady(false)}
                roomId={code}
              />
            </div>
            <aside className="drawing-note">
              {ready || pending.current ? (
                <>
                  <span>🚀</span>위로 휙 밀면
                  <br />
                  슝! 날아가요
                </>
              ) : (
                <>
                  <span>✎</span>마음껏
                  <br />
                  칠해도 괜찮아!
                </>
              )}
            </aside>
          </div>
          <div className="color-palette" aria-label="색상">
            {colors.map(([name, c]) => (
              <button
                key={c}
                aria-label={name}
                aria-pressed={color === c && !erase}
                className={color === c && !erase ? "chosen" : ""}
                style={{ background: c }}
                disabled={busy || !!pending.current}
                onClick={() => {
                  setColor(c);
                  setErase(false);
                  play();
                }}
              >
                {color === c && !erase ? "✓" : ""}
              </button>
            ))}
          </div>
          <div className="launch-row">
            <button
              className={ready ? "ready-button" : "launch-button"}
              disabled={busy || !!pending.current}
              onClick={() => {
                setReady(!ready);
                play();
              }}
            >
              {ready ? "↩ 더 그리기" : "✓ 다 그렸어요"}
            </button>
          </div>
          <p className="draw-status" role="status">
            {status}
          </p>
        </>
      )}
    </main>
  );
}
