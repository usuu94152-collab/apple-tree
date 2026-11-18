import express from "express";
import { createServer } from "node:http";
import { randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { Server, Socket } from "socket.io";
import sharp from "sharp";
import {
  Artwork,
  Reply,
  objectTypes,
  cleanDesign,
  stageIds,
  StageId,
  MAX_IMAGE_BYTES,
  MAX_OBJECTS,
} from "../../shared/protocol.js";
interface Room {
  token: string;
  display?: string;
  emptySince?: number;
  artworks: Artwork[];
  seen: Map<string, boolean>;
  stage?: StageId;
}
export function createApp() {
  const app = express(),
    http = createServer(app),
    io = new Server(http, {
      maxHttpBufferSize: MAX_IMAGE_BYTES * 1.4,
      pingTimeout: 20000,
    });
  const rooms = new Map<string, Room>();
  const attempts = new Map<string, { count: number; until: number }>();
  const limited = (ip: string) => {
    const now = Date.now();
    let a = attempts.get(ip);
    if (!a || a.until < now) {
      a = { count: 0, until: now + 60000 };
      attempts.set(ip, a);
    }
    return ++a.count > 25;
  };
  const reply = (ack: unknown, value: Reply) => {
    if (typeof ack === "function") ack(value);
  };
  const fail = (ack: unknown, error: string) =>
    reply(ack, { ok: false, error });
  const participants = (id: string) => {
    const r = rooms.get(id);
    if (r?.display)
      io.to(r.display).emit("participants", {
        count: [...io.sockets.sockets.values()].filter(
          (s) => s.data.roomId === id && s.data.role === "draw",
        ).length,
      });
  };
  io.on("connection", (s: Socket) => {
    s.on("create-room", (payload: unknown, ack: unknown) => {
      if (s.data.role) return fail(ack, "이미 놀이방에 연결되어 있어요.");
      if (limited(s.handshake.address))
        return fail(ack, "잠시 뒤 다시 시도해 주세요.");
      if (rooms.size >= 500) return fail(ack, "놀이방이 가득 찼어요.");
      let id;
      do {
        id = String(randomInt(100000, 1000000));
      } while (rooms.has(id));
      const token = randomBytes(32).toString("hex");
      rooms.set(id, { token, display: s.id, artworks: [], seen: new Map() });
      s.data = { role: "display", roomId: id };
      s.join(id);
      reply(ack, { ok: true, roomId: id, token, artworks: [] });
    });
    s.on("resume-display", (p: any, ack: unknown) => {
      const r = rooms.get(p?.roomId);
      if (s.data.role) return fail(ack, "이미 연결되어 있어요.");
      if (limited(s.handshake.address))
        return fail(ack, "잠시 뒤 다시 시도해 주세요.");
      if (
        !r ||
        typeof p?.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(p.token) ||
        p.token.length !== r.token.length ||
        !timingSafeEqual(Buffer.from(p.token), Buffer.from(r.token))
      )
        return fail(
          ack,
          "놀이방이 종료되었어요. 서버가 재시작되었을 수 있어요.",
        );
      if (r.display && r.display !== s.id)
        return fail(ack, "다른 큰 화면이 이미 연결되어 있어요.");
      r.display = s.id;
      r.emptySince = undefined;
      s.data = { role: "display", roomId: p.roomId };
      s.join(p.roomId);
      reply(ack, {
        ok: true,
        roomId: p.roomId,
        token: r.token,
        artworks: r.artworks,
        stage: r.stage,
      });
      participants(p.roomId);
    });
    s.on("join-room", (p: any, ack: unknown) => {
      if (limited(s.handshake.address))
        return fail(ack, "방 코드 입력이 너무 빨라요. 잠시 쉬어 주세요.");
      if (s.data.role) return fail(ack, "이미 연결되어 있어요.");
      if (!/^\d{6}$/.test(p?.roomId) || !rooms.has(p.roomId))
        return fail(
          ack,
          "방 코드를 확인해 주세요. 서버가 재시작되면 새 코드가 필요해요.",
        );
      s.data = { role: "draw", roomId: p.roomId, lastLaunch: 0 };
      s.join(p.roomId);
      reply(ack, {
        ok: true,
        roomId: p.roomId,
        stage: rooms.get(p.roomId)!.stage,
      });
      participants(p.roomId);
    });
    s.on("send-artwork", async (p: any, ack: unknown) => {
      const r = rooms.get(s.data.roomId);
      if (s.data.role !== "draw" || !r || p?.roomId !== s.data.roomId)
        return fail(ack, "이 놀이방에 먼저 연결해 주세요.");
      if (
        typeof p.messageId !== "string" ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(p.messageId)
      )
        return fail(ack, "그림 ID가 올바르지 않아요.");
      if (r.seen.has(p.messageId)) {
        if (!r.seen.get(p.messageId) && r.display) {
          const a = r.artworks.find((a) => a.messageId === p.messageId);
          if (a) io.to(r.display).emit("artwork", a);
        }
        return reply(ack, { ok: true, displayed: r.seen.get(p.messageId) });
      }
      if (!r.display)
        return fail(ack, "큰 화면 연결을 기다려 주세요. 그림은 그대로 있어요.");
      if (s.data.busy || Date.now() - s.data.lastLaunch < 800)
        return fail(ack, "조금만 기다렸다 다시 보내 주세요.");
      if (
        !objectTypes.includes(p.objectType) ||
        !Number.isFinite(p.timestamp) ||
        typeof p.imageData !== "string" ||
        p.imageData.length > MAX_IMAGE_BYTES * 1.34 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(p.imageData)
      )
        return fail(ack, "그림 형식 또는 크기를 확인해 주세요.");
      s.data.busy = true;
      s.data.lastLaunch = Date.now();
      try {
        const b = Buffer.from(p.imageData.split(",")[1], "base64");
        if (b.length > MAX_IMAGE_BYTES) throw Error();
        const meta = await sharp(b, { limitInputPixels: 512 * 512 }).metadata();
        if (meta.format !== "png" || meta.width !== 512 || meta.height !== 512)
          throw Error();
        await sharp(b, { limitInputPixels: 512 * 512 })
          .raw()
          .toBuffer();
        if (!rooms.has(p.roomId) || !r.display)
          return fail(ack, "큰 화면 연결을 기다려 주세요.");
        const a: Artwork = {
          messageId: p.messageId,
          roomId: p.roomId,
          objectType: p.objectType,
          imageData: p.imageData,
          design: cleanDesign(p.design),
          timestamp: Date.now(),
        };
        r.artworks.push(a);
        if (r.artworks.length > MAX_OBJECTS) r.artworks.shift();
        r.seen.set(a.messageId, false);
        if (r.seen.size > 500) r.seen.delete(r.seen.keys().next().value!);
        io.to(r.display).emit("artwork", a);
        reply(ack, { ok: true, displayed: false });
      } catch {
        fail(ack, "올바른 512 × 512 PNG 그림이 아니에요.");
      } finally {
        s.data.busy = false;
      }
    });
    // Anyone in the room (big screen or tablet) may pick the place; everyone hears it.
    s.on("set-stage", (p: any, ack: unknown) => {
      const r = rooms.get(s.data.roomId);
      if (!r || !s.data.role) return fail(ack, "놀이방에 먼저 연결해 주세요.");
      if (!stageIds.includes(p?.stage))
        return fail(ack, "장소를 확인해 주세요.");
      r.stage = p.stage;
      io.to(s.data.roomId).emit("stage", { stage: r.stage });
      reply(ack, { ok: true, stage: r.stage });
    });
    s.on("artwork-ready", (p: any) => {
      const r = rooms.get(s.data.roomId);
      if (
        s.data.role === "display" &&
        r?.display === s.id &&
        r.seen.has(p?.messageId)
      ) {
        r.seen.set(p.messageId, true);
        io.to(s.data.roomId).emit("artwork-displayed", {
          messageId: p.messageId,
        });
      }
    });
    s.on("reset-room", (_: unknown, ack: unknown) => {
      const r = rooms.get(s.data.roomId);
      if (r?.display !== s.id) return fail(ack, "보호자 화면에서만 가능해요.");
      r.artworks = [];
      io.to(s.data.roomId).emit("reset");
      reply(ack, { ok: true });
    });
    s.on("close-room", (_: unknown, ack: unknown) => {
      const id = s.data.roomId,
        r = rooms.get(id);
      if (r?.display !== s.id) return fail(ack, "보호자 화면에서만 가능해요.");
      io.to(id).emit("room-closed");
      rooms.delete(id);
      io.in(id).socketsLeave(id);
      reply(ack, { ok: true });
    });
    s.on("disconnect", () => {
      const id = s.data.roomId,
        r = rooms.get(id);
      if (r?.display === s.id) {
        r.display = undefined;
        r.emptySince = Date.now();
        io.to(id).emit("display-offline");
      }
      participants(id);
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, r] of rooms)
      if (r.emptySince && now - r.emptySince > 120000) {
        io.to(id).emit("room-closed");
        rooms.delete(id);
        io.in(id).socketsLeave(id);
      }
    for (const [ip, a] of attempts) if (a.until < now) attempts.delete(ip);
  }, 10000);
  timer.unref();
  app.get("/api/health", (_q, res) => res.json({ ok: true }));
  app.use(express.static(resolve("dist/client")));
  app.get("/{*path}", (_q, res) =>
    res.sendFile(resolve("dist/client/index.html")),
  );
  return {
    http,
    io,
    rooms,
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((r) => io.close(() => r()));
    },
  };
}
