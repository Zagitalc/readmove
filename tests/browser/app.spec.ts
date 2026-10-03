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

test("official sold prices search real addresses without moving the map or mixing examples", async ({
  page,
}, testInfo) => {
  await ready(page);
  const before = await page.evaluate(
    () => window.__readmove.snapshot().camera.centre,
  );
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Official sold prices",
    exact: true,
  });
  await expect(
    panel.getByRole("heading", { name: "Official sold prices" }),
  ).toBeVisible();
  await expect(panel).toContainText("6,325 residential transactions");
  await expect(panel).toContainText("not yet matched to map buildings");
  await expect(page.locator("#sold-results .sold-record")).toHaveCount(20);
  await page.getByLabel("Search sold addresses").fill("RG315NQ");
  await expect(page.locator("#sold-results")).toContainText("WOODBRIDGE ROAD");
  await expect(page.locator("#sold-results")).toContainText("£360,000");
  await page.getByLabel("Search sold addresses").fill("ZZ99 impossible");
  await expect(panel).toContainText("No transactions match");
  await page.getByLabel("Search sold addresses").fill("");
  await page.locator("#sold-type").selectOption("flat");
  await page.locator("#sold-category").selectOption("B");
  const records = page.locator("#sold-results .sold-record");
  await expect(records.first()).toContainText("Category B");
  await expect(records.first()).toContainText("flat");
  await expect(panel).toContainText("Contains HM Land Registry data");
  expect(
    await page.evaluate(() => window.__readmove.snapshot().camera.centre),
  ).toEqual(before);
  const box = await panel.boundingBox(),
    viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({
    path: testInfo.outputPath("official-sold-prices.png"),
  });
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Sold prices", exact: true }),
  ).toBeFocused();
});

test("official price loading failure can be retried without closing the map", async ({
  page,
}) => {
  await page.route("**/data/sales-2025.v1.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await ready(page);
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#official-sales")).toContainText("could not load");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await page.unroute("**/data/sales-2025.v1.json");
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-results .sold-record")).toHaveCount(20);
});

test("official UPRN matches are searchable identifiers and do not become fabricated map locations", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "100 transactions have an official UPRN · 100 have verified coordinates",
  );
  await page.locator("#sold-category").selectOption("");
  await page.getByLabel("Only with an official UPRN").check();
  await expect(page.locator("#sold-count")).toHaveText(
    "100 transactions · showing 20",
  );
  const first = page.locator("#sold-results .sold-record").first();
  await first.getByText("Transaction reference", { exact: true }).click();
  await expect(first.locator(".sale-uprn")).toHaveText("10009203959");
  await expect(first).toContainText("OS coordinate verified");
  await expect(page.locator(".comparison-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.getByLabel("Only with an official UPRN")).toBeChecked();
  await expect(page.locator("#sold-count")).toHaveText(
    "100 transactions · showing 20",
  );
});

test("a mismatched UPRN asset cannot attach identifiers to a different price snapshot", async ({
  page,
}) => {
  await page.route("**/data/sale-locations.v2.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.salesAssetSha256 = "0".repeat(64);
    await route.fulfill({ json: data });
  });
  await ready(page);
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "UPRN lookup unavailable",
  );
  await expect(page.getByLabel("Only with an official UPRN")).toBeDisabled();
  await expect(page.locator("#sold-results .sold-record")).toHaveCount(20);
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await page.unroute("**/data/sale-locations.v2.json");
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "100 transactions have an official UPRN",
  );
  await expect(page.getByLabel("Only with an official UPRN")).toBeEnabled();
});

test("verified sale points are optional, select official sales and filter nearby comparisons", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-03T12:00:00Z"));
  await ready(page);
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "65 inside this map. 35 lie outside",
  );
  await expect(page.locator(".official-sale-pin")).toHaveCount(0);
  await page.getByLabel("Show verified sale points").check();
  await expect(page.locator(".official-sale-pin")).toHaveCount(51);
  await page.locator("#sold-category").selectOption("");
  await expect(page.locator(".official-sale-pin")).toHaveCount(65);
  await page.getByLabel("Show verified sale points").uncheck();
  await expect(page.locator(".official-sale-pin")).toHaveCount(0);
  await page.locator("#sold-category").selectOption("A");
  await page.getByLabel("Only with a location inside this map").check();
  await page.locator("#sold-results [data-locate]").first().click();
  await expect(page.locator("#sold-selected")).toContainText(
    "GLENEAGLES COURT",
  );
  await expect(page.locator("#sold-selected")).toContainText("£195,000");
  await expect(page.locator("#sold-count")).toHaveText(
    "4 nearby mapped sales · showing 4",
  );
  await expect(page.locator(".official-sale-pin")).toHaveCount(5);
  await expect(
    page.locator(".official-sale-pin[aria-pressed=true]"),
  ).toHaveCount(1);
  await expect
    .poll(async () => page.evaluate(() => window.__readmove.snapshot().moving))
    .toBe(false);
  const centre = await page.evaluate(
    () => window.__readmove.snapshot().camera.centre,
  );
  expect(Math.abs(centre[0] - -0.9536733)).toBeLessThan(0.01);
  expect(Math.abs(centre[1] - 51.4526991)).toBeLessThan(0.01);
  await page.locator("#real-radius").selectOption("250");
  await expect(page.locator("#sold-count")).toHaveText(
    "0 nearby mapped sales · showing 0",
  );
  await expect(page.locator(".official-sale-pin")).toHaveCount(1);
  await page.locator("#real-radius").selectOption("1000");
  expect(
    await page.evaluate(() => window.__readmove.snapshot().selected),
  ).toBeUndefined();
  await page.screenshot({
    path: testInfo.outputPath("verified-sale-points.png"),
  });
  const otherPin = page
    .locator('.official-sale-pin[aria-pressed="false"]')
    .first();
  const nextId = await otherPin.getAttribute("data-sale-id");
  await otherPin.focus();
  await otherPin.press("Enter");
  await expect(
    page.locator('.official-sale-pin[aria-pressed="true"]'),
  ).toHaveAttribute("data-sale-id", nextId!);
  await page.getByRole("button", { name: "Back to all sales" }).click();
  await expect(page.locator(".official-sale-pin")).toHaveCount(51);
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await expect(page.locator(".official-sale-pin")).toHaveCount(0);
});
