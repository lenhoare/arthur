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
    cards(page).locator('.card-front .card-paper path[fill="#b2f2bb"]'),
  ).toHaveCount(0);
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

test("student chooser edits, spins to the indicated name, clears its label and reloads", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Student chooser", exact: true })
    .click();
  const wheel = page.locator(".chooser");
  const box = await wheel.boundingBox();
  if (!box) throw new Error("No chooser");
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  const input = page.getByRole("textbox", { name: "Edit chooser names" });
  await input.fill("Alice\n\n Bob \nCharlie\nDaisy");
  await input.press("Control+Enter");
  await expect(wheel.locator("text")).toHaveText([
    "Alice",
    "Bob",
    "Charlie",
    "Daisy",
  ]);
  await page.keyboard.press("Control+z");
  await expect(wheel.locator("text")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(wheel.locator("text")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await wheel.click();
  await expect(wheel).toHaveAttribute("data-spinning", "true");
  await wheel.click(); // A second tap must not restart an active spin.
  await expect(wheel.getByRole("status")).toBeVisible({ timeout: 7000 });
  const rotation = await wheel.locator("svg > g").getAttribute("transform");
  const degrees = Number(rotation!.match(/rotate\(([^ ]+)/)![1]);
  const index = Math.floor(((360 - (degrees % 360)) % 360) / 90);
  await expect(wheel.getByRole("status")).toHaveText(
    ["Alice", "Bob", "Charlie", "Daisy"][index],
  );
  const sliceFill = await wheel
    .locator("svg > g > g")
    .nth(index)
    .locator(":scope > path")
    .evaluate((node) => getComputedStyle(node).fill);
  await expect(wheel.getByRole("status")).toHaveCSS(
    "background-color",
    sliceFill,
  );
  await page.screenshot({ path: "test-results/arthur-chooser.png" });
  await expect(wheel.getByRole("status")).toHaveCount(0, { timeout: 3000 });
  await page.reload();
  await expect(wheel.locator("text")).toHaveText([
    "Alice",
    "Bob",
    "Charlie",
    "Daisy",
  ]);
  await expect(wheel).toHaveAttribute("data-spinning", "false");
  await expect(wheel.getByRole("status")).toHaveCount(0);
});

test("chooser handles empty and single-name lists and cancels on mode change", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Student chooser", exact: true })
    .click();
  const wheel = page.locator(".chooser");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await expect(wheel).toHaveAttribute("aria-disabled", "true");
  await wheel.click({ force: true });
  await expect(wheel).toHaveAttribute("data-spinning", "false");
  await page.getByRole("button", { name: "Switch to editing mode" }).click();
  const box = (await wheel.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  const input = page.getByRole("textbox", { name: "Edit chooser names" });
  await input.fill("Discard me");
  await input.press("Escape");
  await expect(wheel.locator("text")).toHaveCount(0);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  await input.fill("Alice");
  await input.press("Control+Enter");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await wheel.focus();
  await page.keyboard.press("Enter");
  await expect(wheel.getByRole("status")).toHaveText("Alice", {
    timeout: 7000,
  });
  await page.keyboard.press("Space");
  await expect(wheel).toHaveAttribute("data-spinning", "true");
  await page.getByRole("button", { name: "Switch to editing mode" }).click();
  await expect(wheel).toHaveAttribute("data-spinning", "false");
  await expect(wheel.getByRole("status")).toHaveCount(0);
});

test("chooser centre previews a spin in Edit without a popup or moving the object", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Student chooser", exact: true })
    .click();
  const wheel = page.locator(".chooser");
  const box = (await wheel.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  const input = page.getByRole("textbox", { name: "Edit chooser names" });
  await input.fill("Alice\nBob\nCharlie");
  await input.press("Control+Enter");
  const before = await wheel.locator("svg > g").getAttribute("transform");
  await wheel.getByRole("button", { name: "Spin chooser preview" }).click();
  await expect(wheel).toHaveAttribute("data-spinning", "true");
  await expect(wheel).toHaveAttribute("data-spinning", "false", {
    timeout: 7000,
  });
  await expect(wheel.getByRole("status")).toHaveCount(0);
  expect(await wheel.locator("svg > g").getAttribute("transform")).not.toBe(
    before,
  );
  expect(await wheel.boundingBox()).toEqual(box);
  await expect(
    page.getByRole("button", { name: "Switch to interactive mode" }),
  ).toBeVisible();
  // The surrounding wheel still opens the name editor normally.
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
  await expect(input).toHaveValue("Alice\nBob\nCharlie");
});

test("Markdown lessons edit visually, preserve tables and code, undo and reload", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Markdown lesson", exact: true })
    .click();
  const lesson = page.getByRole("group", {
    name: "Markdown lesson",
    exact: true,
  });
  await expect(lesson.locator("table")).toBeVisible();
  await expect(lesson.locator("pre")).toContainText('print("Hello, class!")');
  const box = (await lesson.boundingBox())!;
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await expect(
    lesson.getByRole("button", { name: "Done", exact: true }),
  ).toBeVisible();
  const editor = lesson.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Our ");
  await page.screenshot({ path: "test-results/arthur-markdown-edit.png" });
  await lesson.getByRole("button", { name: "Done", exact: true }).click();
  await expect(lesson.locator("h1")).toHaveText("Our Lesson notes");
  await page.keyboard.press("Control+z");
  await expect(lesson.locator("h1")).toHaveText("Lesson notes");
  await page.keyboard.press("Control+Shift+z");
  await expect(lesson.locator("h1")).toHaveText("Our Lesson notes");
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await expect(editor).toBeVisible();
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Discard ");
  await lesson.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(lesson.locator("h1")).toHaveText("Our Lesson notes");
  await page.reload();
  await expect(lesson.locator("h1")).toHaveText("Our Lesson notes");
  await expect(lesson.locator("table")).toContainText("Meaning");
  await expect(lesson.locator("pre")).toContainText('print("Hello, class!")');
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await expect(lesson.locator('[contenteditable="true"]')).toHaveCount(0);
  await page.screenshot({ path: "test-results/arthur-markdown.png" });
});

test("Markdown source table/code edits and native file round-trip", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Markdown lesson", exact: true })
    .click();
  const lesson = page.getByRole("group", {
    name: "Markdown lesson",
    exact: true,
  });
  const box = (await lesson.boundingBox())!;
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await expect(
    lesson.getByRole("radio", { name: "Rich text", exact: true }),
  ).toHaveCount(0);
  await expect(
    lesson.getByRole("combobox", { name: "Block type" }),
  ).toBeVisible();
  await expect(lesson.locator("table > thead")).toBeHidden();
  await expect(
    lesson.locator("table > tbody > tr > [data-tool-cell]:first-child").first(),
  ).toBeHidden();
  await lesson.locator('button[class*="addColumnButton"]').click();
  await expect(
    lesson
      .locator("table > tbody > tr")
      .first()
      .locator(":scope > :not([data-tool-cell])"),
  ).toHaveCount(3);
  await lesson.locator('button[class*="addRowButton"]').click();
  await expect(lesson.locator("table > tbody > tr")).toHaveCount(3);
  await lesson.getByRole("radio", { name: "Source mode", exact: true }).click();
  const source = lesson.locator(".cm-content[contenteditable=true]:visible");
  await source.fill(
    "# Fractions\n\n| Part | Whole |\n| --- | --- |\n| 1 | 2 |\n\n```python\nprint(1 / 2)\n```",
  );
  await source.fill(
    "# Fractions\n\n| Numerator | Whole |\n| --- | --- |\n| 1 | 2 |\n\n```python\nprint(3 / 4)\n```",
  );
  await lesson.getByRole("button", { name: "Done", exact: true }).click();
  await expect(lesson.locator("table")).toContainText("Numerator");
  await expect(lesson.locator("pre")).toContainText("print(3 / 4)");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("json-export-button").click();
  await page.getByRole("button", { name: "Save to file", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("No downloaded board");
  const saved = JSON.parse(await readFile(path, "utf8"));
  const savedLesson = saved.elements.find(
    (el: any) => el.customData?.arthur?.type === "markdown",
  );
  expect(savedLesson.customData.arthur.data.markdown).toContain("print(3 / 4)");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("load-button").click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Load from file", exact: true })
    .click();
  await (await chooser).setFiles(path);
  await expect(lesson.locator("h1")).toHaveText("Fractions");
  await expect(lesson.locator("table")).toContainText("Numerator");
  await expect(lesson.locator("pre")).toContainText("print(3 / 4)");
  // A duplicate edits independently; clicking away commits the draft.
  await page.mouse.click(box.x + 100, box.y + 50);
  await page.keyboard.press("Control+d");
  await expect(lesson).toHaveCount(2);
  const copy = lesson.nth(1);
  const copyBox = (await copy.boundingBox())!;
  await page.mouse.dblclick(copyBox.x + 100, copyBox.y + 50);
  const editor = copy.locator("[contenteditable=true]").first();
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("More ");
  await page.mouse.click(1200, 800);
  await expect(copy.locator("h1")).toHaveText("More Fractions");
  await expect(lesson.nth(0).locator("h1")).toHaveText("Fractions");
  await page.mouse.dblclick(copyBox.x + 100, copyBox.y + 50);

  await copy.getByRole("radio", { name: "Source mode", exact: true }).click();
  await copy
    .locator(".cm-content[contenteditable=true]:visible")
    .fill("# Source saved directly\n\n**Important**");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await expect(copy.locator("h1")).toHaveText("Source saved directly");
  await expect(copy.locator("strong")).toHaveText("Important");
  await expect(copy.locator('[contenteditable="true"]')).toHaveCount(0);
});

test("multiple-choice editing, corner and interact reveal, undo and reload", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Multiple-choice question", exact: true })
    .click();
  const question = page.locator(".mcq");
  const box = (await question.boundingBox())!;
  await expect(question).toHaveAttribute("data-revealed", "false");
  await question
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await expect(question.locator(".is-correct")).toContainText("Paris");
  await question
    .getByRole("button", { name: "Hide answer", exact: true })
    .click();
  await expect(question.locator(".is-correct")).toHaveCount(0);
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .fill("What is 2 + 2?");
  await page.getByRole("textbox", { name: "Choice A", exact: true }).fill("3");
  await page.getByRole("textbox", { name: "Choice B", exact: true }).fill("4");
  await page.getByRole("textbox", { name: "Choice C", exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Remove choice D", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Correct answer B", exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(question.locator(".mcq-question")).toHaveText("What is 2 + 2?");
  await page.keyboard.press("Control+z");
  await expect(question.locator(".mcq-question")).toContainText(
    "capital of France",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect(question.locator(".mcq-question")).toHaveText("What is 2 + 2?");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await question.click();
  await expect(question.locator(".is-correct")).toContainText("4");
  expect(await question.boundingBox()).toEqual(box);
  await page.screenshot({ path: "test-results/arthur-mcq.png" });
  await question.focus();
  await page.keyboard.press("Space");
  await expect(question).toHaveAttribute("data-revealed", "false");
  await page.keyboard.press("Enter");
  await expect(question).toHaveAttribute("data-revealed", "true");
  await page.reload();
  await expect(question).toHaveAttribute("data-revealed", "false");
  await expect(question.locator(".mcq-question")).toHaveText("What is 2 + 2?");
  await expect(question.locator("li")).toHaveCount(3);
});

test("multiple-choice choice removal, cancel, duplicates and native file preserve the answer", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Multiple-choice question", exact: true })
    .click();
  const question = page.locator(".mcq");
  const box = (await question.boundingBox())!;
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await page
    .getByRole("button", { name: "Remove choice A", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Correct answer A", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Add choice", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Choice D", exact: true })
    .fill("Berlin");
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .press("Control+Enter");
  await question
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await expect(question.locator(".is-correct")).toContainText("Paris");
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .fill("Discard this");
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .press("Escape");
  await expect(question.locator(".mcq-question")).toContainText(
    "capital of France",
  );
  await page.mouse.click(box.x + 100, box.y + 50);
  await page.keyboard.press("Control+d");
  await expect(question).toHaveCount(2);
  const copy = question.nth(1);
  await expect(copy).toHaveAttribute("data-revealed", "false");
  const copyBox = (await copy.boundingBox())!;
  await page.mouse.dblclick(copyBox.x + 100, copyBox.y + 50);
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .fill("Independent question");
  await page
    .getByRole("radio", { name: "Correct answer D", exact: true })
    .check();
  await page.mouse.click(1200, 800);
  await expect(copy.locator(".mcq-question")).toHaveText(
    "Independent question",
  );
  await expect(question.nth(0).locator(".mcq-question")).toContainText(
    "capital of France",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("json-export-button").click();
  await page.getByRole("button", { name: "Save to file", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("No file");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("load-button").click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Load from file", exact: true })
    .click();
  await (await chooser).setFiles(path);
  await expect(copy).toHaveAttribute("data-revealed", "false");
  await copy
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await expect(copy.locator(".is-correct")).toContainText("Berlin");
});

test("appear text edits, fades, reveals in both modes and reloads faint", async ({
  page,
}) => {
  const original = await center(page);
  await page.mouse.click(original.x, original.y);
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Appear text", exact: true }).click();
  const block = page.locator(".appear-text");
  const box = (await block.boundingBox())!;
  await expect
    .poll(
      async () =>
        (
          await scene(page)
        ).elements.find(
          (el: any) => el.customData?.arthur?.type === "appear-text",
        )?.backgroundColor,
    )
    .toBe("#ffffff");
  await expect(block.locator(".appear-text-paper path")).not.toHaveAttribute(
    "fill",
    "#f9efcd",
  );
  await expect(block.locator("p")).toHaveCSS("filter", "blur(13.32px)");
  await expect(block.locator(".appear-text-surface")).toHaveCSS(
    "opacity",
    "0.15",
  );
  await page.mouse.dblclick(box.x + 80, box.y + 50);
  const input = page.getByRole("textbox", { name: "Edit appear text" });
  await expect(input).toHaveCSS("filter", "none");
  await input.fill("The answer is 42");
  await block.getByRole("button", { name: "Show text", exact: true }).click();
  await expect(input).toHaveCount(0);
  await expect(block.locator("p")).toHaveText("The answer is 42");
  await expect(block.locator(".appear-text-surface")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Control+z");
  await expect(block.locator("p")).toHaveText("Click to reveal");
  await page.keyboard.press("Control+Shift+z");
  await expect(block.locator("p")).toHaveText("The answer is 42");
  await page.mouse.dblclick(box.x + 80, box.y + 50);
  await input.fill("Discard me");
  await input.press("Escape");
  await expect(block.locator("p")).toHaveText("The answer is 42");
  await block.getByRole("button", { name: "Hide text", exact: true }).click();
  await expect(block).toHaveAttribute("data-visible", "false");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await block.click();
  await expect(block.locator(".appear-text-surface")).toHaveCSS("opacity", "1");
  expect(await block.boundingBox()).toEqual(box);
  await expect(block.locator("p")).toHaveCSS("filter", "none");
  await page.screenshot({ path: "test-results/arthur-appear.png" });
  await block.focus();
  await page.keyboard.press("Space");
  await expect(block.locator(".appear-text-surface")).toHaveCSS(
    "opacity",
    "0.15",
  );
  await expect(block.locator("p")).toHaveCSS("filter", "blur(13.32px)");
  await page.screenshot({ path: "test-results/arthur-appear-hidden.png" });
  await page.keyboard.press("Enter");
  await expect(block).toHaveAttribute("data-visible", "true");
  await page.reload();
  await expect(block).toHaveAttribute("data-visible", "false");
  await expect(block.locator("p")).toHaveText("The answer is 42");
});

test("split-flap chooser settles left to right, previews, and saves entries", async ({
  page,
}) => {
  const original = await center(page);
  await page.mouse.click(original.x, original.y);
  await page.keyboard.press("Delete");
  await page
    .getByRole("button", { name: "Split-flap chooser", exact: true })
    .click();
  const board = page.locator(".flap-chooser");
  const box = (await board.boundingBox())!;
  expect(box.height).toBe(56);
  await page.evaluate(() => {
    const metrics = { clicks: 0, nonSilent: false };
    (window as any).flapAudioMetrics = metrics;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      metrics.clicks++;
      metrics.nonSilent ||= !!this.buffer
        ?.getChannelData(0)
        .some((sample) => Math.abs(sample) > 0.01);
      return start.apply(this, args);
    };
  });

  await page.mouse.dblclick(box.x + 100, box.y + 35);
  const input = page.getByRole("textbox", { name: "Edit split-flap entries" });
  await input.fill("\n Alexandra \n\n");
  await input.press("Control+Enter");
  await page.keyboard.press("Control+z");
  await expect(board.locator(".flap-empty")).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await board.getByRole("button", { name: "Preview split-flap draw" }).click();
  await expect(board).toHaveAttribute("data-spinning", "true");
  await expect
    .poll(async () => Number(await board.getAttribute("data-settled")))
    .toBeGreaterThan(0);
  expect(Number(await board.getAttribute("data-settled"))).toBeLessThan(9);
  await expect(board.getByRole("status")).toHaveText("Chosen: Alexandra", {
    timeout: 6000,
  });
  await expect(
    board.locator(".flap-tile > .flap-top:not(.flap-turn) > span"),
  ).toHaveText(["A", "L", "E", "X", "A", "N", "D", "R", "A", "", "", ""]);
  await expect(board).toHaveAttribute("data-settled", "12");
  expect(await board.boundingBox()).toEqual(box);
  const audio = await page.evaluate(() => (window as any).flapAudioMetrics);
  expect(audio.clicks).toBeGreaterThan(0);
  expect(audio.nonSilent).toBe(true);

  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await board.click();
  await board.click();
  await expect(board.getByRole("status")).toHaveText("Chosen: Alexandra", {
    timeout: 6000,
  });
  await page.screenshot({ path: "test-results/arthur-flap.png" });
  await board.focus();
  await page.keyboard.press("Enter");
  await expect(board).toHaveAttribute("data-spinning", "true");
  await page.getByRole("button", { name: "Switch to editing mode" }).click();
  await expect(board).toHaveAttribute("data-spinning", "false");
  await expect(board.getByRole("status")).toBeEmpty();
  await page.reload();
  await expect(board.getByRole("status")).toBeEmpty();
  await page.mouse.dblclick(box.x + 100, box.y + 35);
  await expect(input).toHaveValue("Alexandra");
  await input.fill("Discard");
  await input.press("Escape");
  await page.mouse.dblclick(box.x + 100, box.y + 35);
  await expect(input).toHaveValue("Alexandra");
});

test("split-flap supports empty lists, multiple entries, accents and native files", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Split-flap chooser", exact: true })
    .click();
  const board = page.locator(".flap-chooser");
  const box = (await board.boundingBox())!;
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await board.click({ force: true });
  await expect(board).toHaveAttribute("data-spinning", "false");
  await page.getByRole("button", { name: "Switch to editing mode" }).click();
  await page.mouse.dblclick(box.x + 100, box.y + 35);
  await page
    .getByRole("textbox", { name: "Edit split-flap entries" })
    .fill("Élodie\nIce cream\nSam");
  await page
    .getByRole("textbox", { name: "Edit split-flap entries" })
    .press("Control+Enter");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("json-export-button").click();
  await page.getByRole("button", { name: "Save to file", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("No downloaded file");
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("load-button").click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Load from file", exact: true })
    .click();
  await (await chooser).setFiles(path);
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await board.click();
  await expect(board.getByRole("status")).toHaveText(
    /^Chosen: (Élodie|Ice cream|Sam)$/,
    { timeout: 6000 },
  );
  const winner = (await board.getByRole("status").innerText())
    .replace("Chosen: ", "")
    .toUpperCase();
  const tiles = await board
    .locator(".flap-tile > .flap-top:not(.flap-turn) > span")
    .allTextContents();
  expect(tiles.join("").trim()).toBe(winner);
});

test("Markdown baseline sizes preview, save, cancel, undo and scale with geometry", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Markdown lesson", exact: true })
    .click();
  const lesson = page.locator(".markdown-panel");
  const box = (await lesson.boundingBox())!;
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "20px",
  );
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  const size = lesson.getByRole("combobox", { name: "Lesson font size" });
  for (const [value, pixels] of [
    ["tiny", 12],
    ["small", 16],
    ["medium", 20],
    ["large", 26],
  ] as const) {
    await size.selectOption(value);
    await expect(lesson.locator(".markdown-content").first()).toHaveCSS(
      "font-size",
      `${pixels}px`,
    );
  }
  await lesson.getByRole("button", { name: "Done", exact: true }).click();
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "26px",
  );
  await page.keyboard.press("Control+z");
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "20px",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "26px",
  );
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  await size.selectOption("tiny");
  await lesson.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "26px",
  );
  await page.reload();
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "font-size",
    "26px",
  );
  await page.mouse.click(box.x + 100, box.y + 50);
  await page.mouse.move(box.x + box.width + 4, box.y + box.height + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 164, box.y + box.height + 84, {
    steps: 10,
  });
  await page.mouse.up();
  const resized = (await lesson.boundingBox())!;
  expect(resized.width).toBeGreaterThan(box.width);
  const pixels = await lesson
    .locator(".markdown-reading")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(pixels).toBeCloseTo((resized.width * 26) / 640, 1);
});

test("Markdown syntax colours survive stroke changes while plain text follows stroke", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Markdown lesson", exact: true })
    .click();
  const lesson = page.locator(".markdown-panel");
  const box = (await lesson.boundingBox())!;
  const string = lesson.locator(".hljs-string").first();
  await expect(string).toBeVisible();
  const syntaxColor = await string.evaluate((el) => getComputedStyle(el).color);
  await page.getByTestId("color-top-pick-#e03131").click();
  await expect(lesson.locator(".markdown-reading")).toHaveCSS(
    "color",
    "rgb(224, 49, 49)",
  );
  await expect(lesson.locator("pre code")).toHaveCSS(
    "color",
    "rgb(224, 49, 49)",
  );
  await expect(string).toHaveCSS("color", syntaxColor);
  expect(syntaxColor).not.toBe("rgb(224, 49, 49)");
  await page
    .getByRole("button", { name: "Switch to interactive mode" })
    .click();
  await expect(string).toHaveCSS("color", syntaxColor);
  await page.screenshot({ path: "test-results/arthur-markdown-colours.png" });
  await page.reload();
  await expect(string).toHaveCSS("color", syntaxColor);
  await expect(lesson.locator("pre code")).toHaveCSS(
    "color",
    "rgb(224, 49, 49)",
  );
});

test("new components use their defaults and Markdown has a compact block menu", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Markdown lesson", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await scene(page)
        ).elements.find((el: any) => el.customData?.arthur?.type === "markdown")
          ?.backgroundColor,
    )
    .toBe("#ffffff");
  for (const [label, type, background] of [
    ["Flashcard", "flashcard", "#f9efcd"],
    ["Student chooser", "chooser", "#ffffff"],
    ["Markdown lesson", "markdown", "#ffffff"],
    ["Multiple-choice question", "multiple-choice", "#ffffff"],
    ["Appear text", "appear-text", "transparent"],
    ["Split-flap chooser", "flap-chooser", "#333333"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await scene(page)).elements
            .filter((el: any) => el.customData?.arthur?.type === type)
            .at(-1)?.backgroundColor,
      )
      .toBe(background);
  }
  const lesson = page.locator(".markdown-panel").last();
  const box = (await lesson.boundingBox())!;
  await page.mouse.dblclick(box.x + 100, box.y + 50);
  const heading = lesson.getByRole("combobox", { name: "Block type" });
  expect((await heading.boundingBox())!.width).toBeCloseTo(93.6, 1);
  const sizeMenu = lesson.getByRole("combobox", { name: "Lesson font size" });
  await expect(sizeMenu).toHaveCSS("width", "72px");
  for (const property of ["font-family", "font-size", "font-weight"]) {
    const value = await heading.evaluate(
      (el, property) => getComputedStyle(el).getPropertyValue(property),
      property,
    );
    await expect(sizeMenu).toHaveCSS(property, value);
  }
  const size = await lesson
    .getByRole("combobox", { name: "Lesson font size" })
    .boundingBox();
  const headingBox = (await heading.boundingBox())!;
  expect(Math.abs(size!.y - headingBox.y)).toBeLessThan(3);
  await heading.click();
  await expect(
    page.getByRole("option", { name: "Heading 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Heading 2", exact: true }).click();
  await page.screenshot({ path: "test-results/arthur-compact-menu.png" });
});
