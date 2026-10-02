import { expect, test, type Page } from "@playwright/test";

type Hook = {
  snapshot: () => {
    moving: boolean;
    example: string;
    selected?: string;
    neighbourhoodVisible: string;
    footprints: number;
    tilesLoaded: boolean;
    visibleRoadFeatures: number;
    layers: { buildings: boolean };
    scene: {
      resident: number;
      loading: number;
      failed: number;
      maxChunks: number;
      bytes: number;
      maxBytes: number;
      overview: boolean;
    };
    camera: {
      centre: number[];
      zoom: number;
      pitch: number;
      minZoom: number;
      maxZoom: number;
      bounds: number[][];
    };
  };
  project: (id: string) => { x: number; y: number };
  projectRoof: (id: string) => { x: number; y: number };
};
declare global {
  interface Window {
    __readmove: Hook;
  }
}

async function ready(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("canvas.maplibregl-canvas")).toHaveAttribute(
    "data-scene-ready",
    "true",
  );
  await expect(page.locator("#loading")).toBeHidden();
  await expect
    .poll(
      () => page.evaluate(() => window.__readmove?.snapshot().scene.resident),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
}

test("local 3D geography loads without provider calls or JavaScript errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith("http://127.0.0.1:5173")
    )
      external.push(request.url());
  });
  await ready(page);
  expect(
    await page.evaluate(() => window.__readmove.snapshot().footprints),
  ).toBeGreaterThan(5000);
  await expect(
    page.getByRole("heading", { name: "A home is more than four walls." }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("overview.png") });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("example, provenance, sample transactions and comparison work", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.getByRole("button", { name: "Explore an example" }).click();
  await expect(page.locator(".fixture-banner")).toContainText(
    "Fictional property and sales",
  );
  await expect(page.locator("#details .provenance")).toContainText(
    "OpenStreetMap",
  );
  await page.getByRole("button", { name: "Sample sales", exact: true }).click();
  await expect(page.locator(".transaction-list")).toContainText("£385,000");
  await expect(page.locator("#details")).toContainText(
    "FICTIONAL DEVELOPMENT DATA",
  );
  await expect(page.locator(".comparable-list button")).toHaveCount(2);
  await page.locator("#sales-type").selectOption("flat");
  await expect(page.locator(".comparable-list button")).toHaveCount(0);
  await expect(page.locator("#details")).toContainText("No sample sales match");
  await expect(page.locator(".comparison-pin")).toHaveCount(0);
  await page.locator("#sales-type").selectOption("terraced");
  await expect(page.locator(".comparable-list button")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add building to comparison" })
    .click();
  await expect(page.locator("#compare-count")).toHaveText("1");
  await page.locator(".comparable-list button").first().click();
  await page
    .getByRole("button", { name: "Add building to comparison" })
    .click();
  await page
    .getByRole("button", { name: "Open saved building comparison" })
    .click();
  await expect(page.locator(".comparison-item")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("comparison.png") });
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await expect(page.locator(".comparison-item")).toHaveCount(1);
});

test("full Reading coverage keeps the requested camera, streams outlying buildings and evicts detail at overview zoom", async ({
  page,
}, testInfo) => {
  await ready(page);
  const initial = await page.evaluate(() => window.__readmove.snapshot());
  expect(initial.camera.centre[0]).toBeCloseTo(-0.9718, 5);
  expect(initial.camera.centre[1]).toBeCloseTo(51.4589, 5);
  expect(initial.camera.zoom).toBeCloseTo(15.5);
  expect(initial.camera.pitch).toBeCloseTo(58);
  expect(initial.camera.minZoom).toBe(11);
  expect(initial.camera.maxZoom).toBe(19);
  expect(initial.camera.bounds).toEqual([
    [-1.08, 51.39],
    [-0.84, 51.5],
  ]);
  expect(initial.footprints).toBeGreaterThan(97000);
  await page.getByRole("combobox").fill("Woodley");
  await page
    .getByRole("option", { name: /^Woodley/ })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().moving))
    .toBe(false);
  await page.getByRole("combobox").fill("area/104111538/0");
  await page.getByRole("option", { name: /51 Haddon Drive/ }).click();
  await expect(page.locator("#property-heading")).toHaveText("51 Haddon Drive");
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().moving))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().scene.loading))
    .toBe(0);
  const far = await page.evaluate(() => window.__readmove.snapshot());
  expect(far.selected).toBe("area/104111538/0");
  expect(far.scene.resident).toBeGreaterThan(0);
  expect(far.scene.resident).toBeLessThanOrEqual(far.scene.maxChunks);
  expect(far.scene.bytes).toBeLessThanOrEqual(far.scene.maxBytes);
  expect(far.scene.failed).toBe(0);
  await page.getByRole("button", { name: "Close building details" }).click();
  await page.getByRole("button", { name: "Show entire map area" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__readmove.snapshot().scene.overview),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => window.__readmove.snapshot().scene.resident),
    )
    .toBe(0);
  await expect(page.locator("#detail-status")).toContainText("Area overview");
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().moving))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().tilesLoaded))
    .toBe(true);
  expect(
    await page.evaluate(() => window.__readmove.snapshot().visibleRoadFeatures),
  ).toBeGreaterThan(100);
  await page.screenshot({ path: testInfo.outputPath("greater-reading.png") });
  await page
    .getByRole("button", { name: "Return to Reading overview" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__readmove.snapshot().scene.resident),
    )
    .toBeGreaterThan(0);
});

test("failed building downloads retain the map and recover on explicit retry", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/data/v2/chunks/*.json", (route) => {
    requests++;
    return route.fulfill({
      status: 503,
      body: "Unavailable during recovery test",
    });
  });
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#retry-detail")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.__readmove?.snapshot().scene.loading),
    )
    .toBe(0);
  const failed = requests;
  await page.waitForTimeout(250);
  expect(requests).toBe(failed); // Failed chunks do not retry in a tight loop.
  expect(
    await page.evaluate(() => window.__readmove.snapshot().scene.resident),
  ).toBe(0);
  await page.unroute("**/data/v2/chunks/*.json");
  await page.getByRole("button", { name: "Retry detail" }).click();
  await expect
    .poll(
      () => page.evaluate(() => window.__readmove.snapshot().scene.resident),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator("#retry-detail")).toBeHidden();
});

test("keyboard search opens a real building; map picking and layer overrides work", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.getByRole("combobox").fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator("#property-heading")).toHaveText(
    "Reading Town Hall",
  );
  await expect(page.locator(".fixture-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Close building details" }).click();
  await page
    .getByRole("button", { name: "Neighbourhood", exact: false })
    .click();
  await expect(page.locator("#area-legend")).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__readmove.snapshot().neighbourhoodVisible,
    ),
  ).toBe("visible");
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.locator("#layer-neighbourhood").uncheck();
  expect(
    await page.evaluate(
      () => window.__readmove.snapshot().neighbourhoodVisible,
    ),
  ).toBe("none");
  await page.locator("#layer-buildings").uncheck();
  expect(
    await page.evaluate(() => window.__readmove.snapshot().layers.buildings),
  ).toBe(false);
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByRole("button", { name: "Explore an example" }).click();
  const id = await page.evaluate(() => window.__readmove.snapshot().example);
  await page.getByRole("button", { name: "Close building details" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().moving))
    .toBe(false);
  const point = await page.evaluate((id) => window.__readmove.project(id), id);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#details")).toBeVisible();
  expect(await page.evaluate(() => window.__readmove.snapshot().selected)).toBe(
    id,
  );
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.locator("#layer-buildings").check();
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByRole("button", { name: "Close building details" }).click();
  // A tilted roof does not share its ground footprint's screen position.
  await expect
    .poll(() => page.evaluate(() => window.__readmove.snapshot().scene.loading))
    .toBe(0);
  const roof = await page.evaluate(
    (id) => window.__readmove.projectRoof(id),
    id,
  );
  await page.mouse.click(roof.x, roof.y);
  await expect(page.locator("#details")).toBeVisible();
  expect(await page.evaluate(() => window.__readmove.snapshot().selected)).toBe(
    id,
  );
  await page.screenshot({ path: testInfo.outputPath("property.png") });
});

test("details fit the viewport and sources remain accessible", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.getByRole("button", { name: "Explore an example" }).click();
  const panel = await page.locator("#details").boundingBox();
  const viewport = page.viewportSize()!;
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport.width);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport.height);
  if (testInfo.project.name === "mobile") {
    expect(panel!.y).toBeGreaterThan(viewport.height * 0.4);
    expect(panel!.height).toBeLessThanOrEqual(viewport.height * 0.54);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sources & notes" }).click();
  await expect(page.getByRole("dialog")).toContainText("not official LSOAs");
  await expect(page.getByRole("dialog")).toContainText("2026-09-04");
  await page.getByRole("button", { name: "Close sources" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
