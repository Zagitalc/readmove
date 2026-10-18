import { test, expect } from "@playwright/test";

test("flood zones load on demand, draw on the map and appear in building context", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  expect(requests.some((url) => url.includes("flood-zones.v1"))).toBe(false);

  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Flood", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#flood-legend")).toBeVisible();
  await expect(page.locator("#flood-legend")).toContainText(
    "not a property risk",
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__readmove.snapshot().floodLoaded),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => (window as any).__readmove.snapshot().floodVisible,
    ),
  ).toBe("visible");
  await page
    .getByRole("button", { name: "Overview" })
    .or(page.locator("#overview"))
    .first()
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__readmove.snapshot().floodRendered,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText(
    "Environment Agency",
  );
  await page.screenshot({ path: info.outputPath("stage-eleven-layer.png") });

  // Another mode hides the layer again.
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as any).__readmove.snapshot().floodVisible,
    ),
  ).toBe("none");
  await expect(page.locator("#flood-legend")).toBeHidden();

  await page.getByRole("combobox").fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator("#property-heading")).toHaveText(
    "Reading Town Hall",
  );
  const summary = page.locator("#flood-context > summary");
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await page.keyboard.press("Enter");
  const body = page.locator("#flood-context-body");
  await expect(body).toContainText("Neither the centre nor the outline");
  await expect(body).toContainText("not a statement that it cannot flood");
  await expect(body).toContainText(
    "not suitable for showing whether an individual property is at risk",
  );
  await expect(
    body.locator("a[href^='https://check-long-term-flood-risk']"),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("stage-eleven-context.png") });
});
