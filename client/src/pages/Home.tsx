import { Scenery } from "../components/Scenery";
import { svg, svgUrl, objects } from "../objects/catalog";
import { ObjectType } from "../../../shared/protocol";
export function Home() {
  return (
    <main className="home">
      <nav className="home-nav">
        <a className="brand" href="/">
          ✳ 슝슝 <span>그림 놀이터</span>
        </a>
        <span className="nav-note">작은 손끝에서 시작되는 커다란 상상</span>
        <span className="pill">설치 없이, 함께 놀아요</span>
      </nav>
      <section className="hero">
        <div className="eyebrow">SWOOSH! DRAWING PLAYGROUND</div>
        <h1>
          내 그림이 <span>살아 움직이는</span>
          <br />
          마법 같은 놀이터<span className="tiny-star">✦</span>
        </h1>
        <p>
          쓱쓱 그리고, 슝! 날려 보세요.
          <br />
          우리 아이의 상상이 커다란 세상에서 뛰어놀아요.
        </p>
        <div className="home-actions">
          <a className="action draw-action" href="/draw">
            <span className="action-icon">✎</span>
            <div>
              <strong>
                그림 그리기 <b>↗</b>
              </strong>
              <small>태블릿 · 휴대폰에서 시작해요</small>
            </div>
          </a>
          <a className="action display-action" href="/display">
            <span className="action-icon">▣</span>
            <div>
              <strong>
                큰 화면 열기 <b>↗</b>
              </strong>
              <small>PC · TV에 놀이터를 펼쳐요</small>
            </div>
          </a>
        </div>
        <div className="hero-tags">
          <span>✓ 가입 없이 바로</span>
          <span>✓ 자유롭게 마음껏</span>
          <span>✓ 함께 만드는 세상</span>
        </div>
      </section>
      <section className="world-preview">
        <Scenery />
        <div className="world-caption">
          여기는 상상이 자라는 곳 <span>✦</span>
        </div>
        {(["apple", "fish", "balloon", "star"] as ObjectType[]).map((t) => (
          <img
            key={t}
            className={"preview-object " + t}
            src={svgUrl(
              svg(
                t,
                {
                  apple: "#f58a82",
                  fish: "#f4bd56",
                  balloon: "#bca5dc",
                  star: "#ffe397",
                }[t],
              ),
            )}
            alt={objects[t].name}
          />
        ))}
        <div className="preview-note">
          내가 그린 친구들이
          <br />
          <strong>여기서 만나요!</strong>
          <span>↗</span>
        </div>
        <span className="preview-badge">
          우리 아이의 첫 번째 인터랙티브 아트
        </span>
      </section>
      <section className="steps">
        <div>
          <b>01</b>
          <span>마음에 드는 친구를 골라요</span>
          <i>🍎 🐟 🎈 ⭐</i>
        </div>
        <span className="step-arrow">⤳</span>
        <div>
          <b>02</b>
          <span>알록달록, 나만의 색으로</span>
          <i>🖍️</i>
        </div>
        <span className="step-arrow">⤳</span>
        <div>
          <b>03</b>
          <span>슝! 큰 화면에서 만나요</span>
          <i>🚀</i>
        </div>
      </section>
      <footer>
        슝슝 그림 놀이터 <span>정답 없는 그림, 끝없는 상상.</span>
        <span>MADE FOR LITTLE ARTISTS ♡</span>
      </footer>
    </main>
  );
}
