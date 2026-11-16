import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { ObjectType } from "../../../shared/protocol";
import { objects, svg, svgUrl, loadImage } from "../objects/catalog";
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number; erase: boolean };
export interface DrawingHandle {
  undo: () => void;
  clear: () => void;
  compose: () => Promise<string>;
  save: () => void;
}
interface Props {
  type: ObjectType;
  color: string;
  width: number;
  erase: boolean;
  ready: boolean;
  /** True while the flung paper is travelling to the big screen. */
  flying: boolean;
  canCancel: boolean;
  onSwipe: () => void;
  onCancel: () => void;
  roomId: string;
}
export const DrawingCanvas = forwardRef<DrawingHandle, Props>(
  function DrawingCanvas(p, ref) {
    const canvas = useRef<HTMLCanvasElement>(null),
      strokes = useRef<Stroke[]>([]),
      active = useRef<Stroke | null>(null),
      pointer = useRef<number | null>(null),
      paper = useRef<HTMLDivElement>(null),
      start = useRef({ x: 0, y: 0 }),
      samples = useRef<{ y: number; t: number }[]>([]),
      flown = useRef(false);
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
        y,
        tilt,
        lift,
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
    const key = `swoosh-draft-${p.roomId}-${p.type}`;
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
        c.drawImage(await loadImage(svgUrl(svg(p.type))), 0, 0);
        c.drawImage(canvas.current!, 0, 0);
        c.globalCompositeOperation = "destination-in"; // Stroke mask also retains balloon string.
        c.drawImage(await loadImage(svgUrl(svg(p.type, "white", true))), 0, 0);
        c.globalCompositeOperation = "source-over";
        c.drawImage(await loadImage(svgUrl(svg(p.type, "none"))), 0, 0);
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
      active.current = null;
      save();
    };
    return (
      <div className="paper-wrap">
        <div
          ref={paper}
          className={"paper " + (p.ready ? "ready" : "")}
          onPointerDown={(e) => {
            if (pointer.current !== null || flown.current) return;
            pointer.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = { x: e.clientX, y: e.clientY };
            if (p.ready) {
              samples.current = [{ y: e.clientY, t: e.timeStamp }];
              style("", "none");
              paper.current?.classList.add("dragging");
              return;
            }
            const s = {
              points: [point(e)],
              color: p.color,
              width: p.width,
              erase: p.erase,
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
          <img
            className="template"
            draggable={false}
            src={svgUrl(svg(p.type))}
            alt=""
          />
          <canvas
            ref={canvas}
            width={512}
            height={512}
            aria-label={`${objects[p.type].name} 그림 그리는 도화지`}
          />
          <img
            className="outline"
            draggable={false}
            src={svgUrl(svg(p.type, "none"))}
            alt=""
          />
        </div>
        {p.ready && p.canCancel && !p.flying && (
          <button className="cancel-ready" onClick={p.onCancel}>
            ↩ 더 그릴래요
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
            🚀 큰 화면으로 날아가는 중…
          </div>
        )}
        <span className="paper-spark s1">✧</span>
        <span className="paper-spark s2">✳</span>
      </div>
    );
  },
);
