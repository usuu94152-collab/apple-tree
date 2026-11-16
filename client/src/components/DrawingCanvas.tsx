import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import {
  Design,
  Region,
  figureSvg,
  hitRegion,
  loadImage,
  svgUrl,
} from "../objects/figure";
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };
export type Tool = "fill" | "pen" | "erase";
export interface DrawingHandle {
  undo: () => void;
  clear: () => void;
  compose: () => Promise<string>;
  save: () => void;
}
interface Props {
  design: Design;
  tool: Tool;
  color: string;
  width: number;
  ready: boolean;
  /** True while the flung paper is travelling to the big screen. */
  flying: boolean;
  canCancel: boolean;
  onSwipe: () => void;
  onCancel: () => void;
  onFill: (region: Region) => void;
  onStroke: () => void;
  roomId: string;
}
export const DrawingCanvas = forwardRef<DrawingHandle, Props>(
  function DrawingCanvas(p, ref) {
    const canvas = useRef<HTMLCanvasElement>(null),
      strokes = useRef<Stroke[]>([]),
      active = useRef<Stroke | null>(null),
      pointer = useRef<number | null>(null),
      paper = useRef<HTMLDivElement>(null),
      hitMap = useRef<ImageData | null>(null),
      start = useRef({ x: 0, y: 0 }),
      samples = useRef<{ y: number; t: number }[]>([]),
      flown = useRef(false);
    const key = `swoosh-draft-${p.roomId}-figure`;
    const fillUrl = svgUrl(figureSvg(p.design, "fill")),
      outlineUrl = svgUrl(figureSvg(p.design, "outline")),
      maskUrl = svgUrl(figureSvg(p.design, "mask"));
    const style = (transform: string, transition = "none", opacity = "") => {
      const el = paper.current;
      if (!el) return;
      el.style.transition = transition;
      el.style.transform = transform;
      el.style.opacity = opacity;
    };
    // Paper follows the finger: free upward, rubber-band downward, slight tilt sideways.
    const pose = (dx: number, dy: number) => {
      const y = dy > 0 ? 40 * (1 - Math.exp(-dy / 80)) : dy,
        tilt = Math.max(-8, Math.min(8, dx * 0.04)),
        lift = 1 + Math.min(0.06, Math.max(0, -dy) / 2500);
      return {
        tilt,
        css: `translate(${dx * 0.35}px, ${y}px) rotate(${tilt}deg) scale(${lift})`,
      };
    };
    // Bring the paper back from below once the flight has finished (sent or failed).
    useEffect(() => {
      if (p.flying || !flown.current) return;
      flown.current = false;
      style("translateY(90px) scale(0.92)", "none", "0");
      paper.current?.getBoundingClientRect();
      style(
        "",
        "transform 0.55s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease-out",
      );
    }, [p.flying]);
    // Tap map: every region painted in its own colour, read back to know what was tapped.
    const shapeKey = p.design.hat + "/" + p.design.item;
    useEffect(() => {
      let live = true;
      hitMap.current = null;
      void loadImage(svgUrl(figureSvg(p.design, "hit"))).then((img) => {
        if (!live) return;
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const x = c.getContext("2d", { willReadFrequently: true })!;
        x.drawImage(img, 0, 0, 512, 512);
        hitMap.current = x.getImageData(0, 0, 512, 512);
      });
      return () => {
        live = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapeKey]);
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(strokes.current));
      } catch {
        /* Current drawing remains in memory. */
      }
    };
    const render = () => {
      const c = canvas.current?.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, 512, 512);
      for (const s of strokes.current) {
        c.globalCompositeOperation = s.erase
          ? "destination-out"
          : "source-over";
        c.strokeStyle = s.color;
        c.fillStyle = s.color;
        c.lineWidth = s.width;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(s.points[0].x, s.points[0].y);
        for (const t of s.points) c.lineTo(t.x, t.y);
        c.stroke();
        if (s.points.length === 1) {
          c.beginPath();
          c.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalCompositeOperation = "source-over";
    };
    useEffect(() => {
      try {
        strokes.current = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        strokes.current = [];
      }
      active.current = null;
      pointer.current = null;
      render();
    }, [key]);
    useImperativeHandle(ref, () => ({
      undo() {
        strokes.current.pop();
        render();
        save();
      },
      clear() {
        strokes.current = [];
        render();
        save();
      },
      save,
      async compose() {
        const out = document.createElement("canvas");
        out.width = out.height = 512;
        const c = out.getContext("2d")!;
        c.drawImage(await loadImage(fillUrl), 0, 0, 512, 512);
        // Pen strokes only inside the figure, like on screen.
        const pen = document.createElement("canvas");
        pen.width = pen.height = 512;
        const pc = pen.getContext("2d")!;
        pc.drawImage(canvas.current!, 0, 0);
        pc.globalCompositeOperation = "destination-in";
        pc.drawImage(await loadImage(maskUrl), 0, 0, 512, 512);
        c.drawImage(pen, 0, 0);
        c.drawImage(await loadImage(outlineUrl), 0, 0, 512, 512);
        return out.toDataURL("image/png");
      },
    }));
    const point = (e: {
      clientX: number;
      clientY: number;
      currentTarget: Element;
    }) => {
      const r = e.currentTarget.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * 512) / r.width,
        y: ((e.clientY - r.top) * 512) / r.height,
      };
    };
    const finish = (e: React.PointerEvent, cancelled = false) => {
      if (pointer.current !== e.pointerId) return;
      pointer.current = null;
      if (p.ready) {
        paper.current?.classList.remove("dragging");
        const dx = e.clientX - start.current.x,
          dy = e.clientY - start.current.y,
          recent = samples.current.filter((s) => e.timeStamp - s.t < 120),
          first = recent[0],
          velocity =
            first && e.timeStamp > first.t
              ? (e.clientY - first.y) / (e.timeStamp - first.t)
              : 0;
        samples.current = [];
        // A long push upward, or a quick upward flick, throws the paper.
        if (!cancelled && (-dy > 90 || (-dy > 30 && velocity < -0.6))) {
          const { tilt } = pose(dx, dy),
            rect = paper.current!.getBoundingClientRect(),
            travel = rect.bottom + 80,
            ms = Math.round(
              Math.max(260, Math.min(650, travel / Math.max(1.4, -velocity))),
            );
          flown.current = true;
          style(
            `translate(${dx * 0.8}px, ${-travel}px) rotate(${tilt * 2 - 10}deg) scale(0.55)`,
            `transform ${ms}ms cubic-bezier(.2,.65,.35,1), opacity ${ms}ms ease-in`,
            "0",
          );
          p.onSwipe();
        } else style("", "transform 0.4s cubic-bezier(.34,1.56,.64,1)");
        return;
      }
      if (active.current) {
        active.current = null;
        save();
        p.onStroke();
      }
    };
    return (
      <div className="paper-wrap">
        <div
          ref={paper}
          className={
            "paper " + (p.ready ? "ready" : p.tool === "fill" ? "fill" : "pen")
          }
          onPointerDown={(e) => {
            if (pointer.current !== null || flown.current) return;
            pointer.current = e.pointerId;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* Synthetic or already-released pointer: keep going without capture. */
            }
            start.current = { x: e.clientX, y: e.clientY };
            if (p.ready) {
              samples.current = [{ y: e.clientY, t: e.timeStamp }];
              style("", "none");
              paper.current?.classList.add("dragging");
              return;
            }
            const at = point(e);
            if (p.tool === "fill") {
              const map = hitMap.current,
                x = Math.round(at.x),
                y = Math.round(at.y);
              if (map && x >= 0 && y >= 0 && x < 512 && y < 512) {
                const i = (y * 512 + x) * 4;
                const region = hitRegion(
                  p.design,
                  map.data[i],
                  map.data[i + 1],
                  map.data[i + 2],
                );
                if (region && map.data[i + 3] === 255) p.onFill(region);
              }
              return;
            }
            const s = {
              points: [at],
              color: p.color,
              width: p.width,
              erase: p.tool === "erase",
            };
            strokes.current.push(s);
            active.current = s;
            render();
          }}
          onPointerMove={(e) => {
            if (pointer.current !== e.pointerId) return;
            if (p.ready) {
              samples.current.push({ y: e.clientY, t: e.timeStamp });
              if (samples.current.length > 12) samples.current.shift();
              style(
                pose(e.clientX - start.current.x, e.clientY - start.current.y)
                  .css,
              );
              return;
            }
            if (!active.current) return;
            const events = e.nativeEvent.getCoalescedEvents?.() || [
              e.nativeEvent,
            ];
            for (const t of events)
              active.current.points.push(
                point({
                  clientX: t.clientX,
                  clientY: t.clientY,
                  currentTarget: e.currentTarget,
                }),
              );
            render();
          }}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
        >
          <img className="layer" draggable={false} src={fillUrl} alt="" />
          <canvas
            className="layer"
            ref={canvas}
            width={512}
            height={512}
            style={{
              maskImage: `url("${maskUrl}")`,
              WebkitMaskImage: `url("${maskUrl}")`,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
            }}
            aria-label="블록 친구 꾸미는 도화지"
          />
          <img className="layer" draggable={false} src={outlineUrl} alt="" />
        </div>
        {p.ready && p.canCancel && !p.flying && (
          <button className="cancel-ready" onClick={p.onCancel}>
            ↩ 더 꾸밀래요
          </button>
        )}
        {p.ready && !p.flying && (
          <div className="fling-hint" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        {p.flying && (
          <div className="flying-note" aria-hidden="true">
            🚂 기차역으로 날아가는 중…
          </div>
        )}
      </div>
    );
  },
);
