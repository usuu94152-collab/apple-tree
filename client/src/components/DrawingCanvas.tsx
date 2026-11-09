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
      start = useRef(0);
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
        const delta = start.current - e.clientY;
        (e.currentTarget as HTMLElement).style.transform = "";
        if (!cancelled && delta > 75) p.onSwipe();
        return;
      }
      active.current = null;
      save();
    };
    return (
      <div className="paper-wrap">
        <div
          className={"paper " + (p.ready ? "ready" : "")}
          onPointerDown={(e) => {
            if (pointer.current !== null) return;
            pointer.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = e.clientY;
            if (p.ready) return;
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
              e.currentTarget.style.transform = `translateY(${Math.min(35, e.clientY - start.current)}px)`;
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
        {p.ready && (
          <button className="cancel-ready" onClick={p.onCancel}>
            ↩ 더 그릴래요
          </button>
        )}
        <span className="paper-spark s1">✧</span>
        <span className="paper-spark s2">✳</span>
      </div>
    );
  },
);
