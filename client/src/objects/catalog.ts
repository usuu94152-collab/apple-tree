import { ObjectType } from "../../../shared/protocol";
export const objects: Record<
  ObjectType,
  {
    name: string;
    emoji: string;
    path: string;
    details: string;
    animation: string;
  }
> = {
  apple: {
    name: "사과",
    emoji: "🍎",
    path: "M252 136 C164 67 78 136 100 260 C112 340 167 408 221 386 Q256 368 290 387 C350 415 409 313 416 235 C424 143 343 86 272 136 Z",
    details:
      '<path d="M256 141 Q249 88 277 66" fill="none"/><path d="M265 111 Q297 53 343 78 Q325 124 265 111" fill="#80bb72"/>',
    animation: "sway",
  },
  fish: {
    name: "물고기",
    emoji: "🐟",
    path: "M145 250 L67 174 Q40 250 67 330 L145 271 C207 393 376 350 430 256 C365 147 207 126 145 250 Z",
    details:
      '<path d="M337 199 Q310 255 337 310" fill="none"/><circle cx="365" cy="238" r="9" fill="#36555b"/><path d="M206 239 Q246 250 208 280" fill="none"/>',
    animation: "swim",
  },
  balloon: {
    name: "풍선",
    emoji: "🎈",
    path: "M256 65 C84 65 85 290 244 344 L232 366 L280 366 L268 344 C426 290 427 65 256 65 Z M256 367 Q215 406 267 448",
    details: '<path d="M179 130 Q143 166 151 203" stroke="white" fill="none"/>',
    animation: "float",
  },
  star: {
    name: "별",
    emoji: "⭐",
    path: "M256 66 L312 181 L440 199 L347 289 L369 418 L256 358 L143 418 L165 289 L72 199 L200 181 Z",
    details:
      '<circle cx="224" cy="253" r="7" fill="#36555b"/><circle cx="289" cy="253" r="7" fill="#36555b"/><path d="M237 281 Q256 300 276 281" fill="none"/>',
    animation: "twinkle",
  },
};
export const svg = (type: ObjectType, fill = "white", outline = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g stroke="${outline ? "#36555b" : "none"}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"><path d="${objects[type].path}" fill="${fill}"/>${outline ? objects[type].details : ""}</g></svg>`;
export const svgUrl = (s: string) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}
