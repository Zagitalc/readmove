import { test, expect } from "@playwright/test";

test("official LSOA density layer and building area context load on demand", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  expect(requests.some((url) => url.includes("neighbourhoods.v1"))).toBe(false);

  await page
    .getByRole("button", { name: "Neighbourhood", exact: true })
    .click();
  await expect(page.locator("#area-legend")).toContainText(
    "Usual residents per km²",
  );
  await expect(page.locator("#area-legend li")).toHaveCount(5);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__readmove.snapshot().neighbourhoodAreas,
      ),
    )
    .toBe(217);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__readmove.snapshot().neighbourhoodRendered,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("ONS");
  await page.screenshot({ path: info.outputPath("stage-nine-layer.png") });

  await page.getByRole("combobox").fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator("#property-heading")).toHaveText(
    "Reading Town Hall",
  );
  const summary = page.locator("#area-context > summary");
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await page.keyboard.press("Enter");
  const body = page.locator("#area-context-body");
  await expect(body).toContainText(/Reading \d{3}[A-Z]/);
  await expect(body).toContainText(/E01\d{6}/);
  await expect(body).toContainText("Usual residents");
  await expect(body).toContainText("never this building or its residents");
  await page.screenshot({ path: info.outputPath("stage-nine-context.png") });
});
