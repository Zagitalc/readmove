import { expect, test } from "@playwright/test";

test("surface water loads on demand and replaces the river overlay", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  const overlayRequests = () =>
    requests.filter((url) => url.endsWith("/data/surface-water.v1.webp"));
  expect(overlayRequests()).toHaveLength(0);

  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await expect(page.locator("#flood-legend")).toBeVisible();
  await page.getByRole("button", { name: "Map layers" }).click();
  await page.locator("#layer-surface-water").check();
  await page.getByRole("button", { name: "Map layers" }).click();

  const legend = page.locator("#surface-water-legend");
  await expect(legend).toBeVisible();
  await expect(legend.locator("li")).toHaveText([
    "3.3% (1 in 30)",
    "1% (1 in 100)",
    "0.1% (1 in 1,000)",
  ]);
  await expect(page.locator("#flood-legend")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__readmove.snapshot().surfaceWaterLoaded,
      ),
    )
    .toBe(true);
  expect(overlayRequests()).toHaveLength(1);
  await page.screenshot({ path: info.outputPath("surface-water.png") });

  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await expect(legend).toBeHidden();
  await expect(page.locator("#flood-legend")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as any).__readmove.snapshot().surfaceWaterVisible,
    ),
  ).toBe("none");
});
