import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Artwork } from "../../../shared/protocol";
import { socket, request } from "../network/socket";
import { World } from "../game/World";
import { Scenery } from "../components/Scenery";
import { setSound, soundEnabled } from "../game/sound";
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
    [showCode, setShowCode] = useState(false);
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
        setInitial(r.artworks || []);
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
    socket
      .on("connect", connect)
      .on("disconnect", disconnect)
      .on("participants", participants)
      .on("room-closed", end);
    socket.connect();
    return () => {
      active = false;
      socket
        .off("connect", connect)
        .off("disconnect", disconnect)
        .off("participants", participants)
        .off("room-closed", end);
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
      <Scenery />
      {initial && <World initial={initial} />}
      <a className="display-brand brand" href="/">
        ✳ 슝슝 <span>그림 놀이터</span>
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
            ↶ 배경 초기화
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
          <div className="eyebrow">함께 만드는 우리 놀이터</div>
          {count === 0 || showCode ? (
            <>
              <h1>
                작은 그림을
                <br />큰 세상으로, 슝!
              </h1>
              <p>
                태블릿으로 QR 코드를 찍거나
                <br />
                그림 그리기에서 코드를 입력해요.
              </p>
              {qr && <img src={qr} alt="태블릿 연결 QR 코드" />}
              <div className="room-code" aria-label="놀이방 코드">
                {room}
              </div>
              <small>서로 다른 곳에서도 같은 주소로 만나요.</small>
            </>
          ) : (
            <button onClick={() => setShowCode(true)}>
              ● {count}명과 함께 노는 중 · {room}
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
          ? "친구를 톡! 눌러 보세요 ✨"
          : "그림을 그려서 보내면 이곳에 친구가 나타나요 ✨"}
        <button
          onClick={() => {
            setAudio(!sound);
            setSound(!sound);
          }}
        >
          {sound ? "🔊 소리 켜짐 · 눌러 활성화" : "🔇 소리 꺼짐"}
        </button>
      </div>
    </main>
  );
}
