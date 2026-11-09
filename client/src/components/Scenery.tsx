export function Scenery() {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="sun">☀</div>
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="rainbow" />
      <div className="hill h1" />
      <div className="hill h2" />
      <svg className="tree" viewBox="0 0 480 520">
        <path d="M214 460L227 215H269L291 460Z" fill="#ba8150" />
        <path
          d="M245 330L156 234M258 290L338 207"
          stroke="#ba8150"
          strokeWidth="25"
          strokeLinecap="round"
        />
        <g fill="#6cab69">
          <circle cx="142" cy="196" r="92" />
          <circle cx="324" cy="183" r="99" />
          <circle cx="239" cy="111" r="105" />
          <circle cx="235" cy="218" r="111" />
        </g>
        <g fill="#87c479">
          <circle cx="170" cy="131" r="62" />
          <circle cx="287" cy="104" r="59" />
          <circle cx="334" cy="191" r="62" />
        </g>
        <path
          d="M245 379V440"
          stroke="#d39960"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
      <div className="pond" />
      <div className="flowers">
        ✿ <span>✿</span> ✿
      </div>
      <div className="grass">⌁ ⌁ ⌁</div>
    </div>
  );
}
