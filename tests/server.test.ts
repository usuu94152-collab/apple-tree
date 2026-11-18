import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { io, Socket } from "socket.io-client";
import sharp from "sharp";
import { createApp } from "../server/src/app";
const app = createApp();
let url: string, imageData: string;
const clients: Socket[] = [];
before(async () => {
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + (app.http.address() as { port: number }).port;
  imageData =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 512, height: 512, channels: 4, background: "#ee5566" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
});
after(async () => {
  clients.forEach((s) => s.disconnect());
  await app.close();
});
async function client() {
  const s = io(url, { transports: ["websocket"], forceNew: true });
  clients.push(s);
  await new Promise<void>((r) => s.on("connect", () => r()));
  return s;
}
const ask = (s: Socket, e: string, p: any = {}) =>
  s.timeout(3000).emitWithAck(e, p);
const artwork = (roomId: string, extra = {}) => ({
  messageId: crypto.randomUUID(),
  roomId,
  objectType: "figure",
  imageData,
  timestamp: Date.now(),
  ...extra,
});
async function pair() {
  const d = await client(),
    r = await ask(d, "create-room"),
    t = await client();
  assert.equal((await ask(t, "join-room", { roomId: r.roomId })).ok, true);
  return { d, t, r };
}
test("real websocket transfer, display confirmation and idempotent retry", async () => {
  const { d, t, r } = await pair();
  assert.match(r.roomId, /^\d{6}$/);
  const a = artwork(r.roomId);
  const received = new Promise<any>((resolve) => d.once("artwork", resolve));
  assert.equal((await ask(t, "send-artwork", a)).ok, true);
  assert.deepEqual(await received, {
    ...a,
    timestamp: app.rooms.get(r.roomId)!.artworks[0].timestamp,
  });
  const shown = new Promise<any>((resolve) =>
    t.once("artwork-displayed", resolve),
  );
  d.emit("artwork-ready", { messageId: a.messageId });
  assert.equal((await shown).messageId, a.messageId);
  assert.equal((await ask(t, "send-artwork", a)).displayed, true);
  assert.equal(app.rooms.get(r.roomId)!.artworks.length, 1);
});
test("invalid code, unauthorized room, invalid type and malformed image are rejected", async () => {
  const { t, r } = await pair();
  const outsider = await client();
  assert.equal((await ask(outsider, "join-room", { roomId: "bad" })).ok, false);
  assert.equal(
    (await ask(outsider, "send-artwork", artwork(r.roomId))).ok,
    false,
  );
  assert.equal((await ask(t, "send-artwork", artwork("999999"))).ok, false);
  assert.equal(
    (await ask(t, "send-artwork", artwork(r.roomId, { objectType: "rocket" })))
      .ok,
    false,
  );
  assert.equal(
    (
      await ask(
        t,
        "send-artwork",
        artwork(r.roomId, { imageData: "data:image/png;base64,aGVsbG8=" }),
      )
    ).ok,
    false,
  );
});
test("dress-up design is kept only when every field is valid", async () => {
  const { t, d, r } = await pair();
  const good = {
    fills: { torso: "#e3342f", legL: "#1f5fbf" },
    hat: "crown",
    face: "wink",
    item: "balloon",
  };
  const got = new Promise<any>((resolve) => d.once("artwork", resolve));
  assert.equal(
    (await ask(t, "send-artwork", artwork(r.roomId, { design: good }))).ok,
    true,
  );
  assert.deepEqual((await got).design, good);
  const bad = [
    { ...good, hat: "rocket" },
    { ...good, fills: { torso: "red" } },
    { ...good, fills: { tail: "#ffffff" } },
    "crown",
  ];
  for (const design of bad) {
    await new Promise((resolve) => setTimeout(resolve, 820));
    const next = new Promise<any>((resolve) => d.once("artwork", resolve));
    assert.equal(
      (await ask(t, "send-artwork", artwork(r.roomId, { design }))).ok,
      true,
    );
    assert.equal((await next).design, undefined);
  }
});
test("a tablet can pick the place; the big screen and newcomers hear it", async () => {
  const { t, d, r } = await pair();
  const heard = new Promise<any>((resolve) => d.once("stage", resolve));
  assert.equal((await ask(t, "set-stage", { stage: "subway" })).ok, true);
  assert.equal((await heard).stage, "subway");
  assert.equal((await ask(t, "set-stage", { stage: "moon" })).ok, false);
  const late = await client();
  assert.equal(
    (await ask(late, "join-room", { roomId: r.roomId })).stage,
    "subway",
  );
  const outsider = await client();
  assert.equal(
    (await ask(outsider, "set-stage", { stage: "station" })).ok,
    false,
  );
});
test("strict image size and decode; rapid launches throttled", async () => {
  const { t, r } = await pair();
  assert.equal(
    (
      await ask(
        t,
        "send-artwork",
        artwork(r.roomId, {
          imageData: "data:image/png;base64," + "A".repeat(540000),
        }),
      )
    ).ok,
    false,
  );
  assert.equal((await ask(t, "send-artwork", artwork(r.roomId))).ok, true);
  assert.equal((await ask(t, "send-artwork", artwork(r.roomId))).ok, false);
});
test("display disconnect, owner resume and snapshot recovery", async () => {
  const { d, t, r } = await pair();
  const a = artwork(r.roomId);
  await ask(t, "send-artwork", a);
  const gone = new Promise((resolve) => t.once("display-offline", resolve));
  d.disconnect();
  await gone;
  assert.equal((await ask(t, "send-artwork", artwork(r.roomId))).ok, false);
  const replacement = await client();
  assert.equal(
    (
      await ask(replacement, "resume-display", {
        roomId: r.roomId,
        token: "x".repeat(64),
      })
    ).ok,
    false,
  );
  const recovered = await ask(replacement, "resume-display", r);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.artworks[0].messageId, a.messageId);
});
test("only display can reset/close, reset clears artwork, close invalidates room", async () => {
  const { d, t, r } = await pair();
  await ask(t, "send-artwork", artwork(r.roomId));
  assert.equal((await ask(t, "reset-room")).ok, false);
  assert.equal((await ask(d, "reset-room")).ok, true);
  assert.equal(app.rooms.get(r.roomId)!.artworks.length, 0);
  assert.equal((await ask(d, "close-room")).ok, true);
  assert.equal(app.rooms.has(r.roomId), false);
});
test("retains only the newest 30 figures", async () => {
  const { t, r } = await pair();
  let first = "";
  for (let i = 0; i < 31; i++) {
    const a = artwork(r.roomId);
    if (i === 0) first = a.messageId;
    const res = await ask(t, "send-artwork", a);
    assert.equal(res.ok, true, res.error);
    if (i < 30) await new Promise((resolve) => setTimeout(resolve, 810));
  }
  const list = app.rooms.get(r.roomId)!.artworks;
  assert.equal(list.length, 30);
  assert.ok(!list.some((a) => a.messageId === first));
  assert.ok(list.every((a) => a.objectType === "figure"));
});
test("room guess attempts are rate limited", async () => {
  const s = await client();
  let res: any;
  for (let i = 0; i < 30; i++)
    res = await ask(s, "join-room", { roomId: "000000" });
  assert.match(res.error, /너무 빨라요/);
});
