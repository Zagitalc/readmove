import { test, expect } from "@playwright/test";
test("stage-6 optional points and in-map discovery survive the merge", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.locator("#sold-open").click();
  await expect(page.locator("#sold-location-status")).toContainText(
    "177 inside the map",
  );
  await expect(page.getByLabel("Show verified sale points")).not.toBeChecked();
  await expect(page.locator(".sale-pin")).toHaveCount(0);
  await page.locator("#sold-category").selectOption("");
  await page.getByLabel("Only with a location inside this map").check();
  await expect(page.locator("#sold-count")).toHaveText(
    "177 transactions · showing 20",
  );
  await page.getByLabel("Show verified sale points").check();
  await expect(page.locator(".sale-pin")).toHaveCount(160);
  // All 177 sales remain represented across 160 exact-coordinate groups.
  expect(
    await page
      .locator(".sale-pin")
      .evaluateAll((pins) =>
        pins.reduce(
          (sum, pin) => sum + Number((pin as HTMLElement).dataset.saleCount),
          0,
        ),
      ),
  ).toBe(177);
  const grouped = page
    .getByRole("button", {
      name: "Browse 2 official sales at this location",
    })
    .first();
  await grouped.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sold-fit")).toBeVisible();
  await expect(page.locator("#sold-query")).toHaveValue("");
  await page.getByLabel("Show verified sale points").uncheck();
  await expect(page.locator(".sale-pin")).toHaveCount(0);
  await page.locator("#sold-fit").click();
  await expect(page.getByLabel("Show verified sale points")).toBeChecked();
  expect(await page.locator(".sale-pin").count()).toBeGreaterThan(0);
  await page.locator("#sold-close").click();
  await expect(page.locator(".sale-pin")).toHaveCount(0);
});
