import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import sharp from "sharp";
const PAPER = "블록 친구 꾸미는 도화지";
// Push the finished friend up off the paper, like throwing it to the big screen.
async function fling(page: Page, distance = 160, steps = 8) {
  const box = (await page.getByLabel(PAPER).boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - distance, { steps });
  await page.mouse.up();
}
/** Page coordinates of a point in the 512×512 figure template. */
async function at(page: Page, x: number, y: number) {
  const b = (await page.getByLabel(PAPER).boundingBox())!;
  return [b.x + (x / 512) * b.width, b.y + (y / 512) * b.height] as const;
}
const pixel = (page: Page, x = 256, y = 256) =>
  page
    .getByLabel(PAPER)
    .evaluate(
      (el: HTMLCanvasElement, [x, y]) =>
        el.getContext("2d")!.getImageData(x, y, 1, 1).data[3],
      [x, y],
    );

test("home, dress-up, fill, accessories, real PNG delivery, refresh and reset", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /블록 친구 꾸미기/ }),
  ).toBeVisible();
  await expect(
    page.getByLabel("블록 친구들이 기차를 타는 기차역"),
  ).toBeVisible();
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
  await expect(draw.getByLabel(PAPER)).toBeVisible();
  const outfits: [string, string, string][] = [
    ["왕관", "풍선", "빨강"],
    ["안전모", "여행 가방", "초록"],
    ["양갈래 머리", "신호 깃발", "보라"],
  ];
  for (const [hat, item, shirt] of outfits) {
    await draw.getByRole("tab", { name: /모자/ }).click();
    await draw.getByRole("button", { name: hat, exact: true }).click();
    await draw.getByRole("tab", { name: /소품/ }).click();
    await draw.getByRole("button", { name: item, exact: true }).click();
    await draw.getByRole("tab", { name: /표정/ }).click();
    await draw.getByRole("button", { name: "윙크", exact: true }).click();
    // Tap-to-fill the shirt and the trousers.
    await draw.getByRole("button", { name: shirt, exact: true }).click();
    await draw.mouse.click(...(await at(draw, 256, 280)));
    await draw.getByRole("button", { name: "파랑", exact: true }).click();
    await draw.mouse.click(...(await at(draw, 200, 420)));
    // A pen stroke that starts outside the friend: the outside part is never sent.
    await draw.getByRole("button", { name: "그리기", exact: true }).click();
    await draw.getByRole("button", { name: "노랑", exact: true }).click();
    await draw.mouse.move(...(await at(draw, 60, 300)));
    await draw.mouse.down();
    await draw.mouse.move(...(await at(draw, 210, 300)), { steps: 10 });
    await draw.mouse.up();
    await draw.getByRole("button", { name: "펜 굵기 변경" }).click();
    await draw.getByRole("button", { name: "색칠하기", exact: true }).click();
    if (hat === "왕관")
      await draw.screenshot({
        path: "test-results/drawing-tablet.png",
        fullPage: true,
      });
    await draw.getByRole("button", { name: "✓ 다 만들었어요" }).click();
    await fling(draw);
    await expect(draw.getByRole("status")).toContainText("짜잔");
    await expect(
      draw.getByRole("button", { name: "✓ 다 만들었어요" }),
    ).toBeEnabled();
    await draw.waitForTimeout(1250);
  }
  expect(sent).toHaveLength(3);
  const msg = JSON.parse(sent[0].slice(sent[0].indexOf("[")))[1];
  expect(msg.objectType).toBe("figure");
  const { data, info } = await sharp(
    Buffer.from(msg.imageData.split(",")[1], "base64"),
  )
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => [
    ...data.slice((y * 512 + x) * 4, (y * 512 + x) * 4 + 4),
  ];
  expect(info.channels).toBe(4);
  expect(px(10, 10)[3]).toBe(0);
  expect(px(80, 300)[3]).toBe(0); // pen outside the friend is cut away
  expect(px(256, 280)).toEqual([227, 52, 47, 255]); // red shirt
  expect(px(200, 430)).toEqual([31, 95, 191, 255]); // blue left leg
  expect(px(300, 430)).toEqual([255, 255, 255, 255]); // right leg untouched
  expect(px(290, 182)).toEqual([255, 210, 63, 255]); // yellow face
  expect(px(420, 110)[3]).toBe(255); // balloon
  await page.screenshot({ path: "test-results/world.png" });
  await page.reload();
  await expect(page.getByRole("button", { name: /1명과 함께/ })).toBeVisible();
  await page.getByRole("button", { name: "보호자 설정" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "↶ 기차역 비우기" }).click();
  await page.setViewportSize({ width: 900, height: 650 });
  await expect(
    page.getByLabel("블록 친구들이 기차를 타는 기차역"),
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

test("touch pen strokes, fill undo, erase, start over and offline preservation", async ({
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
  await expect(draw.getByLabel(PAPER)).toBeVisible();
  const fillLayer = draw.locator(".paper img.layer").first();
  // Fill, then undo the fill.
  await draw.getByRole("button", { name: "빨강", exact: true }).click();
  await draw.mouse.click(...(await at(draw, 256, 280)));
  await expect(fillLayer).toHaveAttribute("src", /e3342f/);
  await draw.getByRole("button", { name: "실행 취소" }).click();
  await expect(fillLayer).not.toHaveAttribute("src", /e3342f/);
  // Real touch strokes through CDP.
  await draw.getByRole("button", { name: "그리기", exact: true }).click();
  const [sx, sy] = await at(draw, 256, 256),
    [ex, ey] = await at(draw, 300, 300);
  const touch = await context.newCDPSession(draw);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sx, y: sy }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: ex, y: ey }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(await pixel(draw)).toBeGreaterThan(0);
  await draw.getByRole("button", { name: "실행 취소" }).click();
  expect(await pixel(draw)).toBe(0);
  await draw.mouse.click(sx, sy);
  await draw.getByRole("button", { name: "지우개", exact: true }).click();
  await draw.mouse.click(sx, sy);
  expect(await pixel(draw)).toBe(0);
  await draw.getByRole("button", { name: "실행 취소" }).click();
  expect(await pixel(draw)).toBeGreaterThan(0);
  draw.once("dialog", (d) => d.accept());
  await draw.getByRole("button", { name: "전체 지우기" }).click();
  expect(await pixel(draw)).toBe(0);
  // Offline: the friend comes back and stays, then goes once online again.
  await draw.getByRole("button", { name: "빨강", exact: true }).click();
  await draw.mouse.click(sx, sy);
  await context.setOffline(true);
  await expect(draw.getByRole("status")).toContainText("끊겼어요");
  await draw.getByRole("button", { name: "✓ 다 만들었어요" }).click();
  await fling(draw);
  await expect(draw.getByRole("status")).toContainText("그대로");
  await expect(draw.getByRole("status")).toContainText("다시 위로");
  expect(await pixel(draw)).toBeGreaterThan(0);
  await context.setOffline(false);
  await expect(draw.getByRole("status")).toContainText("연결됐어요");
  await draw.waitForTimeout(700);
  await fling(draw);
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
  const canvas = draw.getByLabel(PAPER);
  await expect(canvas).toBeVisible();
  await draw.getByRole("button", { name: "그리기", exact: true }).click();
  const b = (await canvas.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height * 0.65;
  await draw.mouse.move(x, y);
  await draw.mouse.down();
  await draw.mouse.move(x, y - 120, { steps: 10 });
  await draw.mouse.up();
  expect(launches).toBe(0);
  await draw.getByRole("button", { name: "✓ 다 만들었어요" }).click();
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
  // A short but quick upward flick also throws the paper.
  await draw.waitForTimeout(1300);
  await draw.getByRole("button", { name: "✓ 다 만들었어요" }).click();
  await fling(draw, 60, 2);
  await expect.poll(() => launches).toBe(2);
  await expect(draw.getByRole("status")).toContainText("짜잔");
  await context.close();
});
