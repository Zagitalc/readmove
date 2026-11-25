import { expect, test } from "@playwright/test";

test("research nearby sales and schools without losing the selected place", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  const search = page.getByRole("combobox");
  await search.fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  const heading = page.getByRole("heading", { name: "Reading Town Hall" });
  await expect(heading).toBeVisible();
  const area = page.locator("#area-context");
  await area.locator(":scope > summary").click();
  await expect(area).toContainText("Reading 019B");
  await page.getByRole("button", { name: "Nearby sold prices" }).click();
  await expect(page.locator("#sold-heading")).toHaveText(
    "Sold prices within 1 km",
  );
  await expect(
    page.locator("#sold-results .sold-record").first(),
  ).toContainText("m straight line");
  await page.getByRole("button", { name: "Search all sold prices" }).click();
  await expect(page.locator("#sold-heading")).toHaveText(
    "Official sold prices",
  );
  await page.getByRole("button", { name: "Back to selected place" }).click();
  await expect(heading).toBeFocused();
  await expect(area).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Schools near here" }).click();
  await expect(page.locator("#schools-heading")).toHaveText(
    "Schools within 1.5 km",
  );
  await expect(page.locator(".school-list li").first()).toContainText(
    "m straight-line",
  );
  await page.keyboard.press("Escape");
  await expect(heading).toBeFocused();
  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(page.locator("#flood-legend")).toBeVisible();
});
