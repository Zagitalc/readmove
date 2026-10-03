import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "177 inside the map",
  );
}
async function stationary(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__readmove.snapshot().moving),
    )
    .toBe(false);
}
async function assertFit(page: Page) {
  await stationary(page);
  const result = await page.evaluate(() => {
    const panel = document
      .querySelector("#official-sales")!
      .getBoundingClientRect();
    const nav = document.querySelector(".modes")!.getBoundingClientRect();
    const controls = document
      .querySelector(".map-controls")!
      .getBoundingClientRect();
    const mobile = innerWidth <= 700;
    const points = [...document.querySelectorAll(".sale-pin")].map((p) => {
      const r = p.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    return {
      points,
      left: mobile ? 20 : panel.right + 20,
      right: controls.left - 20,
      top: nav.bottom + 20,
      bottom: mobile ? panel.top - 20 : innerHeight - 125,
    };
  });
  expect(result.points.length).toBeGreaterThan(0);
  for (const p of result.points) {
    expect(p.x).toBeGreaterThanOrEqual(result.left);
    expect(p.x).toBeLessThanOrEqual(result.right);
    expect(p.y).toBeGreaterThanOrEqual(result.top);
    expect(p.y).toBeLessThanOrEqual(result.bottom);
  }
}
test("search → select → comparisons → filters → fit → back → close works by keyboard", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.locator("#sold-query").fill("RG1 4PF");
  await page.locator("#sold-type").selectOption("flat");
  await expect(page.locator("#sold-count")).toHaveText(
    "1 transactions · showing 1",
  );
  const select = page.getByRole("button", {
    name: "Show mapped sale",
    exact: true,
  });
  await select.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sold-heading")).toContainText("GLENEAGLES COURT");
  const selectedRecord = page.locator(".sold-body > .sold-record");
  await selectedRecord.locator("summary").click();
  await expect(selectedRecord).toContainText(
    "official OS coordinate; building link unverified",
  );
  await expect(selectedRecord).not.toContainText("outside map bounds");
  await selectedRecord.locator("summary").click();

  await expect(page.locator("#sold-query")).toHaveValue("");
  await expect(page.locator("#sold-type")).toHaveValue("flat");
  await expect(page.locator("#sold-category")).toHaveValue("A");
  await expect(page.locator("#sold-count")).toHaveText(
    "3 nearby sales · showing 3",
  );
  await stationary(page);
  const camera = await page.evaluate(
    () => (window as any).__readmove.snapshot().camera,
  );
  await page.locator("#sold-radius").selectOption("2000");
  await page.locator("#sold-since").fill("2025-09-01");
  await page.locator("#sold-since").dispatchEvent("change");
  await page.locator("#sold-category").selectOption("");
  expect(
    await page.evaluate(() => (window as any).__readmove.snapshot().camera),
  ).toEqual(camera);
  const fit = page.getByRole("button", {
    name: "Fit nearby sales",
    exact: true,
  });
  await fit.focus();
  await page.keyboard.press("Enter");
  await assertFit(page);
  await page.locator(".sold-body").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath("nearby-fit.png") });
  await page.locator("#sold-radius").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("nearby-filters.png") });
  const otherPoint = page.locator(".sale-pin:not(.selected)").first();
  const otherId = await otherPoint.getAttribute("data-sale-id");
  await otherPoint.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".sale-pin.selected")).toHaveAttribute(
    "data-sale-id",
    otherId!,
  );
  await expect(page.locator("#sold-query")).toHaveValue("");
  await expect(page.locator("#sold-radius")).toHaveValue("2000");
  await expect(page.locator("#sold-since")).toHaveValue("2025-09-01");

  await page.locator(".sold-body").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const close = page.getByRole("button", { name: "Close sold prices" });
  const box = await close.boundingBox();
  expect(box).not.toBeNull();
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.id,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    ),
  ).toBe("sold-close");
  await page.getByRole("button", { name: "Back to sold prices" }).click();
  await expect(page.locator("#sold-query")).toBeFocused();
  await expect(page.locator("#sold-query")).toHaveValue("");
  await page.locator("#sold-query").fill("RG1 4PF");
  await page
    .getByRole("button", { name: "Show mapped sale", exact: true })
    .click();
  await expect(page.locator("#sold-radius")).toHaveValue("2000");
  await expect(page.locator("#sold-since")).toHaveValue("2025-09-01");
  await expect(page.locator("#sold-category")).toHaveValue("");
  await close.click();
  await expect(page.locator("#official-sales")).toBeHidden();
  await expect(page.locator(".sale-pin")).toHaveCount(0);
  await expect(page.locator("#sold-open")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("empty comparisons fit the selected point and Escape restores navigation", async ({
  page,
}) => {
  await open(page);
  await page.locator("#sold-query").fill("RG1 4PF");
  await page
    .getByRole("button", { name: "Show mapped sale", exact: true })
    .click();
  await page.locator("#sold-since").fill("2026-01-01");
  await page.locator("#sold-since").dispatchEvent("change");
  await expect(page.locator("#sold-results")).toContainText(
    "No nearby sales match",
  );
  await expect(page.locator(".sale-pin")).toHaveCount(1);
  await page.getByRole("button", { name: "Fit nearby sales" }).click();
  await assertFit(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#official-sales")).toBeHidden();
  await expect(page.locator("#sold-open")).toBeFocused();
});
test("loading is closable and a delayed response cannot resurrect map markers", async ({
  page,
}) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/data/sale-locations.v2.json", async (route) => {
    await hold;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.locator("#sold-open").click();
  await expect(page.locator("#official-sales")).toContainText(
    "Loading the local",
  );
  await page.locator("#sold-close").click();
  release();
  await expect(page.locator("#sold-location-status")).toContainText(
    "177 inside the map",
  );
  await expect(page.locator("#official-sales")).toBeHidden();
  await expect(page.locator(".sale-pin")).toHaveCount(0);
  await page.locator("#sold-open").click();
  await expect(page.locator("#sold-results .sold-record")).toHaveCount(20);
});
test("fit includes all results beyond the first page on a narrow phone and restores camera limits", async ({
  page,
}, info) => {
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 375, height: 667 });
  await open(page);
  await page.locator("#sold-query").fill("RG1 4PF");
  await page
    .getByRole("button", { name: "Show mapped sale", exact: true })
    .click();
  await page.locator("#sold-radius").selectOption("5000");
  await page.locator("#sold-category").selectOption("");
  await expect(page.locator("#sold-results .sold-record")).toHaveCount(20);
  expect(await page.locator(".sale-pin").count()).toBeGreaterThan(21);
  await page.getByRole("button", { name: "Fit nearby sales" }).click();
  await assertFit(page);
  await page.locator("#sold-close").click();
  const camera = await page.evaluate(
    () => (window as any).__readmove.snapshot().camera,
  );
  expect(camera.minZoom).toBe(11);
  expect(camera.maxZoom).toBe(19);
  expect(camera.bounds).toEqual([
    [-1.08, 51.39],
    [-0.84, 51.5],
  ]);
});
