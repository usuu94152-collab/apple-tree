import { useState } from "react";
import { World } from "../game/World";
import { StageId, stageIds, stageNames } from "../three/stage";
import { figureSvg, sampleDesigns, svgUrl } from "../objects/figure";
const friends = sampleDesigns
  .slice(0, 3)
  .map((d) => svgUrl(figureSvg(d, "full")));
export function Home() {
  const [stage, setStage] = useState<StageId>("station");
  return (
    <main className="home">
      <nav className="home-nav">
        <a className="brand" href="/">
          <span className="brand-brick" aria-hidden="true" />
          슝슝 <span>블록 기차역</span>
        </a>
        <span className="pill">설치 없이, 함께 놀아요</span>
      </nav>
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow">CHOO-CHOO! BLOCK STATION</div>
          <h1>
            내가 꾸민 <span className="hl">블록 친구</span>가
            <br />
            기차를 타요! 🚂
          </h1>
          <p>
            옷을 칠하고 모자를 씌우고, 위로 슝! 날려 보내면
            <br />큰 화면의 기차역에 내 친구가 도착해요.
          </p>
          <div className="home-actions">
            <a className="action draw-action" href="/draw">
              <span className="action-icon">🎨</span>
              <span>
                <strong>블록 친구 꾸미기</strong>
                <small>태블릿 · 휴대폰에서 시작해요</small>
              </span>
            </a>
            <a className="action display-action" href="/display">
              <span className="action-icon">🚉</span>
              <span>
                <strong>기차역 열기</strong>
                <small>PC · TV에 기차역을 펼쳐요</small>
              </span>
            </a>
          </div>
        </div>
        <div className="hero-friends" aria-hidden="true">
          {friends.map((src, i) => (
            <img key={i} src={src} alt="" className={"hero-friend f" + i} />
          ))}
        </div>
      </section>
      <div className="preview-tabs" role="group" aria-label="미리 볼 장소">
        {stageIds.map((id) => (
          <button
            key={id}
            aria-pressed={stage === id}
            className={stage === id ? "on" : ""}
            onClick={() => setStage(id)}
          >
            {stageNames[id]}
          </button>
        ))}
      </div>
      <section className="world-preview" aria-label="미리 보기">
        <World key={stage} initial={[]} demo stage={stage} />
      </section>
      <section className="steps">
        <div>
          <b>1</b>
          <i>🪣</i>
          <span>옷 색깔을 톡톡 칠해요</span>
        </div>
        <div>
          <b>2</b>
          <i>🎩</i>
          <span>모자 · 표정 · 소품을 골라요</span>
        </div>
        <div>
          <b>3</b>
          <i>🚀</i>
          <span>위로 휙! 날려 보내요</span>
        </div>
        <div>
          <b>4</b>
          <i>🚂</i>
          <span>기차 타고 칙칙폭폭 출발!</span>
        </div>
      </section>
      <footer>
        슝슝 블록 기차역 · 가입 없이, 광고 없이{" "}
        <span>MADE FOR LITTLE CONDUCTORS ♡</span>
      </footer>
    </main>
  );
}
