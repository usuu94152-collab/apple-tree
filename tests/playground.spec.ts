import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("home, drawing tools, actual PNG delivery of all four objects, refresh and reset", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: /그림 그리기/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.goto("/display");
  const code = page.getByLabel("놀이방 코드");
  await expect(code).toHaveText(/\d{6}/);
  const room = (await code.innerText()).trim();
  const tablet = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
  });
  const draw = await tablet.newPage();
  draw.on("pageerror", (e) => errors.push(e.message));
  const sent: string[] = [];
  draw.on("websocket", (ws) =>
    ws.on("framesent", (f) => {
      const text = String(f.payload);
      if (text.includes("send-artwork")) sent.push(text);
    }),
  );
  await draw.goto("/draw?room=" + room);
  await expect(
    draw.getByRole("button", { name: "사과", exact: true }),
  ).toBeVisible();
  for (const name of ["사과", "물고기", "풍선", "별"]) {
    await draw.getByRole("button", { name, exact: true }).click();
    const canvas = draw.getByLabel(name + " 그림 그리는 도화지");
    const box = (await canvas.boundingBox())!;
    await draw.mouse.click(box.x + 10, box.y + 10);
    await draw.getByRole("button", { name: "빨강", exact: true }).click();
    await draw.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await draw.mouse.down();
    await draw.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
      steps: 10,
    });
    await draw.mouse.up();
    await draw.getByRole("button", { name: "파랑", exact: true }).click();
    await draw.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4);
    await draw.mouse.down();
    await draw.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6, {
      steps: 10,
    });
    await draw.mouse.up();
    await draw.getByRole("button", { name: "펜 굵기 변경" }).click();
    await draw.getByRole("button", { name: "지우개", exact: true }).click();
    await draw.getByRole("button", { name: "지우개", exact: true }).click();
    await draw.getByRole("button", { name: "실행 취소" }).click();
    await draw.getByRole("button", { name: "파랑", exact: true }).click();
    await draw.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    if (name === "사과")
      await draw.screenshot({
        path: "test-results/drawing-tablet.png",
        fullPage: true,
      });
    await draw.getByRole("button", { name: /슝! 날려 보내기/ }).click();
    await expect(draw.getByRole("status")).toContainText("짜잔");
    await expect(
      draw.getByRole("button", { name: /슝! 날려 보내기/ }),
    ).toBeEnabled();
    await draw.waitForTimeout(1050);
  }
  expect(sent).toHaveLength(4);
  const png = JSON.parse(sent[0].slice(sent[0].indexOf("[")))[1].imageData;
  const { data, info } = await sharp(Buffer.from(png.split(",")[1], "base64"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(info.channels).toBe(4);
  expect(data[3]).toBe(0);
  expect(data[(10 * 512 + 10) * 4 + 3]).toBe(0);
  expect(data[(230 * 512 + 230) * 4]).toBeGreaterThan(200);
  expect(data[(281 * 512 + 281) * 4 + 2]).toBeGreaterThan(150);
  expect(
    data.some(
      (v: number, i: number) =>
        i % 4 === 0 && v === 54 && data[i + 1] === 85 && data[i + 2] === 91,
    ),
  ).toBe(true);
  expect(data[(256 * 512 + 256) * 4 + 3]).toBe(255);
  expect(data.some((v: number, i: number) => i % 4 === 0 && v > 200)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/world.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("button", { name: /1명과 함께/ })).toBeVisible();
  await page.getByRole("button", { name: "보호자 설정" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "↶ 배경 초기화" }).click();
  await page.setViewportSize({ width: 900, height: 650 });
  await expect(
    page.getByLabel("아이들의 그림이 살아 움직이는 놀이터"),
  ).toBeVisible();
  await draw.setViewportSize({ width: 390, height: 844 });
  await draw.screenshot({
    path: "test-results/drawing-phone.png",
    fullPage: true,
  });
  expect(
    await draw.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await tablet.close();
});
test("touch pointer strokes, transparent composite, outline, undo, erase, clear and offline preservation", async ({
  page,
  browser,
}) => {
  await page.goto("/display");
  await expect(page.getByLabel("놀이방 코드")).toHaveText(/\d{6}/);
  const room = await page.getByLabel("놀이방 코드").innerText();
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 768, height: 1024 },
    }),
    draw = await context.newPage();
  await draw.goto("/draw?room=" + room);
  const c = draw.getByLabel("사과 그림 그리는 도화지");
  await expect(c).toBeVisible();
  const b = (await c.boundingBox())!;
  const touch = await context.newCDPSession(draw);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width * 0.5, y: b.y + b.height * 0.5 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width * 0.6, y: b.y + b.height * 0.6 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBeGreaterThan(0);
  await draw.getByRole("button", { name: "실행 취소" }).click();
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBe(0);
  await draw.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await draw.getByRole("button", { name: "지우개", exact: true }).click();
  await draw.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBe(0);
  await draw.getByRole("button", { name: "실행 취소" }).click();
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBeGreaterThan(0);
  draw.once("dialog", (d) => d.accept());
  await draw.getByRole("button", { name: "전체 지우기" }).click();
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBe(0);
  await draw.getByRole("button", { name: "빨강", exact: true }).click();
  await draw.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await context.setOffline(true);
  await expect(draw.getByRole("status")).toContainText("끊겼어요");
  await draw.getByRole("button", { name: /슝! 날려 보내기/ }).click();
  await expect(draw.getByRole("status")).toContainText("그림은 그대로");
  expect(
    await c.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(256, 256, 1, 1).data[3],
    ),
  ).toBeGreaterThan(0);
  await context.setOffline(false);
  await expect(draw.getByRole("status")).toContainText("연결됐어요");
  await draw.getByRole("button", { name: "다시 보내기" }).click();
  await expect(draw.getByRole("status")).toContainText("짜잔");
  await context.close();
});
test("drawing upwards never sends; ready drag can cancel or launch", async ({
  page,
  browser,
}) => {
  await page.goto("/display");
  await expect(page.getByLabel("놀이방 코드")).toHaveText(/\d{6}/);
  const room = await page.getByLabel("놀이방 코드").innerText();
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const draw = await context.newPage();
  let launches = 0;
  draw.on("websocket", (ws) =>
    ws.on("framesent", (f) => {
      if (String(f.payload).includes("send-artwork")) launches++;
    }),
  );
  await draw.goto("/draw?room=" + room);
  const canvas = draw.getByLabel("사과 그림 그리는 도화지");
  await expect(canvas).toBeVisible();
  const b = (await canvas.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height * 0.65;
  await draw.mouse.move(x, y);
  await draw.mouse.down();
  await draw.mouse.move(x, y - 120, { steps: 10 });
  await draw.mouse.up();
  expect(launches).toBe(0);
  await draw.getByRole("button", { name: "✓ 다 그렸어요" }).click();
  await draw.mouse.move(x, y);
  await draw.mouse.down();
  await draw.mouse.move(x, y - 100, { steps: 6 });
  await draw.mouse.move(x, y + 10, { steps: 6 });
  await draw.mouse.up();
  expect(launches).toBe(0);
  await draw.mouse.move(x, y);
  await draw.mouse.down();
  await draw.mouse.move(x, y - 120, { steps: 10 });
  await draw.mouse.up();
  await expect(draw.getByRole("status")).toContainText("짜잔");
  expect(launches).toBe(1);
  await context.close();
});
