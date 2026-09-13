import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const cards = (page: Page) => page.locator(".flashcard");
async function center(page: Page, index = 0) {
  const box = await cards(page).nth(index).boundingBox();
  if (!box) throw new Error("No card");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function edit(page: Page, text: string, side = "front", index = 0) {
  const point = await center(page, index);
  await page.mouse.dblclick(point.x, point.y);
  const input = page.getByRole("textbox", { name: `Edit ${side} text` });
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Control+Enter");
  await expect(input).toHaveCount(0);
}
async function scene(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("arthur.board.v1") ?? "{}"),
  );
}
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(error));
  // Exercise Excalidraw's own cross-browser file download/input fallback.
  // OS file-picker dialogs are outside Playwright's DOM automation.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
  });
  await page.goto("/");
  await expect(cards(page)).toHaveCount(1);
});

test("edit both sides, undo/redo, interact, and reload fronts with content intact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await edit(page, "What is the capital of France?");
  await expect(cards(page).locator(".card-front p")).toHaveText(
    "What is the capital of France?",
  );
  await expect(page.locator(".excalidraw")).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(cards(page).locator(".card-front p")).toHaveText("bonjour");
  await page.keyboard.press("Control+Shift+z");
  await expect(cards(page).locator(".card-front p")).toHaveText(
    "What is the capital of France?",
  );
  await page.getByRole("button", { name: "Flip to back", exact: true }).click();
  await expect(cards(page)).toHaveAttribute("data-side", "back");
  await edit(page, "Paris", "back");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await cards(page).click();
  await expect(cards(page)).toHaveAttribute("data-side", "front");
  await cards(page).click();
  await expect(cards(page)).toHaveAttribute("data-side", "back");
  await expect
    .poll(
      async () =>
        (
          await scene(page)
        ).elements?.[0]?.customData?.arthur?.data.back,
    )
    .toBe("Paris");
  await page.reload();
  await expect(cards(page)).toHaveAttribute("data-side", "front");
  await expect(cards(page).locator(".card-back p")).toHaveText("Paris");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/arthur-edit.png" });
});

test("native duplication, deletion, undo and clipboard preserve independent content", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await edit(page, "Original question");
  const point = await center(page);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("Control+d");
  await expect(cards(page)).toHaveCount(2);
  await edit(page, "Independent copy", "front", 1);
  await expect(cards(page).nth(0).locator(".card-front p")).toHaveText(
    "Original question",
  );
  const copy = await center(page, 1);
  await page.mouse.click(copy.x, copy.y);
  await page.keyboard.press("Delete");
  await expect(cards(page)).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(1).locator(".card-front p")).toHaveText(
    "Independent copy",
  );
  await page.mouse.click(copy.x, copy.y);
  await page.keyboard.press("Control+c");
  await page.mouse.move(1050, 700);
  await page.keyboard.press("Control+v");
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(2).locator(".card-front p")).toHaveText(
    "Independent copy",
  );
  await edit(page, "Pasted card", "front", 2);
  await expect(cards(page).nth(1).locator(".card-front p")).toHaveText(
    "Independent copy",
  );
});

test("drag, resize and zoom retain card alignment", async ({ page }) => {
  const before = await cards(page).boundingBox();
  const point = await center(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 160, point.y + 100, { steps: 10 });
  await page.mouse.up();
  const moved = await cards(page).boundingBox();
  expect(moved!.x - before!.x).toBeCloseTo(160, 0);
  expect(moved!.y - before!.y).toBeCloseTo(100, 0);
  await page.mouse.move(
    moved!.x + moved!.width + 4,
    moved!.y + moved!.height + 4,
  );
  await page.mouse.down();
  await page.mouse.move(
    moved!.x + moved!.width + 104,
    moved!.y + moved!.height + 74,
    { steps: 10 },
  );
  await page.mouse.up();
  const resized = await cards(page).boundingBox();
  expect(resized!.width).toBeGreaterThan(moved!.width + 50);
  await page.getByRole("button", { name: "Zoom in" }).click();
  const zoomed = await cards(page).boundingBox();
  expect(zoomed!.width).toBeGreaterThan(resized!.width);
  await edit(page, "Still editable");
  await expect(cards(page).locator(".card-front p")).toHaveText(
    "Still editable",
  );
});

test("download and reopen a portable board", async ({ page }) => {
  await edit(page, "A portable question");
  await page.getByRole("button", { name: "Flip to back", exact: true }).click();
  await edit(page, "A portable answer", "back");
  await page.getByTestId("color-top-pick-#b2f2bb").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("json-export-button").click();
  await page.getByRole("button", { name: "Save to file", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("No downloaded board");
  const document = JSON.parse(await readFile(path, "utf8"));
  expect(document.type).toBe("excalidraw");
  expect(document.elements[0].customData.arthur.data.front).toBe(
    "A portable question",
  );
  expect(document.elements[0].customData.arthur.data.back).toBe(
    "A portable answer",
  );
  expect(document.elements[0].backgroundColor).toBe("#b2f2bb");
  expect(document.elements[0].link).toBe(null);
  await edit(page, "Changed afterwards", "back");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("load-button").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Load from file", exact: true })
    .click();
  await (await chooserPromise).setFiles(path);
  await expect(cards(page).locator(".card-front p")).toHaveText(
    "A portable question",
  );
  await expect(cards(page).locator(".card-back p")).toHaveText(
    "A portable answer",
  );
  await expect(
    cards(page).locator('.card-front .card-paper path[fill="#b2f2bb"]'),
  ).toHaveCount(1);
  await expect(cards(page)).toHaveAttribute("data-side", "front");
});

test("native colour controls style both faces and undo without a canvas rectangle underneath", async ({
  page,
}) => {
  await expect(page.locator(".app-header")).toHaveCount(0);
  await expect(
    page
      .locator(".App-toolbar")
      .getByRole("button", { name: "Switch to interactive mode" }),
  ).toBeVisible();
  const point = await center(page);
  await page.mouse.click(point.x, point.y);
  await page.getByTestId("color-top-pick-#b2f2bb").click();
  for (const face of ["front", "back"]) {
    await expect(
      cards(page).locator(`.card-${face} .card-paper path[fill="#b2f2bb"]`),
    ).toHaveCount(1);
  }
  await page.locator(".excalidraw").focus();
  await page.keyboard.press("Control+z");
  await expect(
    cards(page).locator('.card-front .card-paper path[fill="#f9efcd"]'),
  ).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(
    cards(page).locator('.card-front .card-paper path[fill="#b2f2bb"]'),
  ).toHaveCount(1);
  await page.getByTestId("color-top-pick-#e03131").click();
  await expect(cards(page)).toHaveCSS("color", "rgb(224, 49, 49)");
  await page.getByRole("button", { name: "Flip to back", exact: true }).click();
  await expect(cards(page)).toHaveAttribute("data-side", "back");
  const pixel = await page
    .locator("canvas.static")
    .evaluate((canvas, point) => {
      const target = canvas as HTMLCanvasElement;
      const box = target.getBoundingClientRect();
      return [
        ...target
          .getContext("2d")!
          .getImageData(
            (point.x - box.x) * devicePixelRatio,
            (point.y - box.y) * devicePixelRatio,
            1,
            1,
          ).data,
      ];
    }, point);
  expect(pixel.slice(0, 3)).toEqual([255, 255, 255]);
  await expect
    .poll(async () => (await scene(page)).elements[0].backgroundColor)
    .toBe("#b2f2bb");
  await page.reload();
  await expect(
    cards(page).locator('.card-front .card-paper path[fill="#b2f2bb"]'),
  ).toHaveCount(1);
  await expect(cards(page)).toHaveCSS("color", "rgb(224, 49, 49)");
  await page.screenshot({ path: "test-results/native-colours.png" });
});

test("early prototype boards migrate while keeping their native colour choices", async ({
  page,
}) => {
  await expect.poll(async () => (await scene(page)).elements?.length).toBe(1);
  const original = await scene(page);
  original.elements[0].link = "https://arthur.invalid/component/flashcard";
  original.elements[0].backgroundColor = "#a5d8ff";
  original.elements[0].strokeColor = "transparent";
  original.elements[0].customData.arthur.data = {
    front: "Old question",
    back: "Old answer",
  };
  await page.addInitScript(
    (document) =>
      localStorage.setItem("arthur.board.v1", JSON.stringify(document)),
    original,
  );
  await page.reload();
  await expect(cards(page).locator(".card-front p")).toHaveText("Old question");
  await expect(cards(page).locator(".card-back p")).toHaveText("Old answer");
  await expect(
    cards(page).locator('.card-front .card-paper path[fill="#a5d8ff"]'),
  ).toHaveCount(1);
  await expect
    .poll(async () => (await scene(page)).elements[0].link)
    .toBe(null);
});

test("cancel, click-away save, and corner-flip save keep both sides correct", async ({
  page,
}) => {
  const point = await center(page);
  await page.mouse.dblclick(point.x, point.y);
  await page.getByRole("textbox").fill("Discard this");
  await page.getByRole("textbox").press("Escape");
  await expect(cards(page).locator(".card-front p")).toHaveText("bonjour");
  await page.mouse.dblclick(point.x, point.y);
  await page.getByRole("textbox").fill("Save by flipping");
  await page.getByRole("button", { name: "Flip to back", exact: true }).click();
  await expect(cards(page).locator(".card-front p")).toHaveText(
    "Save by flipping",
  );
  await expect(cards(page)).toHaveAttribute("data-side", "back");
  await page.mouse.dblclick(point.x, point.y);
  await page.getByRole("textbox").fill("Answer saved on blur");
  await page.mouse.click(1100, 700);
  await expect(cards(page).locator(".card-back p")).toHaveText(
    "Answer saved on blur",
  );
  await page.mouse.dblclick(point.x, point.y);
  await page.getByRole("textbox").fill("Answer saved by mode change");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await expect(cards(page).locator(".card-back p")).toHaveText(
    "Answer saved by mode change",
  );
});

test("rotation and panning preserve direct editing and interactive geometry is locked", async ({
  page,
}) => {
  const point = await center(page);
  await page.mouse.click(point.x, point.y);
  const box = (await cards(page).boundingBox())!;
  await page.mouse.move(point.x, box.y - 20);
  await page.mouse.down();
  await page.mouse.move(point.x + 140, box.y + 40, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(async () => (await scene(page)).elements?.[0]?.angle)
    .toBeGreaterThan(0.2);
  await edit(page, "Rotated card");
  await page.mouse.move(1100, 700);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(1160, 750, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect
    .poll(async () => (await scene(page)).appState?.scrollX)
    .not.toBe(0);
  await edit(page, "After panning");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  const before = (await cards(page).boundingBox())!;
  const cardCenter = await center(page);
  await page.mouse.move(cardCenter.x, cardCenter.y);
  await page.mouse.down();
  await page.mouse.move(cardCenter.x + 100, cardCenter.y + 50, { steps: 10 });
  await page.mouse.up();
  const after = (await cards(page).boundingBox())!;
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  await page.screenshot({ path: "test-results/arthur-interact.png" });
});

test("touch users can flip cards and return to editing", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Flip to back", exact: true }).tap();
  await expect(cards(page)).toHaveAttribute("data-side", "back");
  await page.getByRole("button", { name: "Switch to interactive mode" }).tap();
  await cards(page).tap();
  await expect(cards(page)).toHaveAttribute("data-side", "front");
  await page.getByRole("button", { name: "Switch to editing mode" }).tap();
  await expect(
    page.getByRole("button", { name: "Switch to interactive mode" }),
  ).toBeVisible();
  await context.close();
});

test("toolbar creation is undoable and cards group with ordinary shapes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Flashcard", exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  await page.locator(".excalidraw").focus();
  await page.keyboard.press("Control+z");
  await expect(cards(page)).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(cards(page)).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(cards(page)).toHaveCount(1);
  await page.keyboard.press("r");
  await page.mouse.move(950, 350);
  await page.mouse.down();
  await page.mouse.move(1100, 500, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press("v");
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+g");
  await expect
    .poll(async () => {
      const visible = (await scene(page)).elements?.filter(
        (element: { isDeleted: boolean }) => !element.isDeleted,
      );
      return (
        visible?.length === 2 &&
        visible[0].groupIds.length === 1 &&
        visible[0].groupIds[0] === visible[1].groupIds[0]
      );
    })
    .toBe(true);
  const point = await center(page);
  const before = (await cards(page).boundingBox())!;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 80, point.y + 40, { steps: 10 });
  await page.mouse.up();
  const after = (await cards(page).boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(80, 0);
});
