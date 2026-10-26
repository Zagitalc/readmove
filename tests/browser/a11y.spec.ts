import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

/** WCAG 2.1 A/AA automated rules. Automation finds only part of the problems; see docs/verification.md. */
const found: Record<string, unknown>[] = [];
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The map canvas is exercised by keyboard/search paths; its pixels are not scannable.
    .exclude(".maplibregl-canvas")
    .analyze();
  for (const v of results.violations)
    found.push({
      view: label,
      rule: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
      summary: v.nodes[0].any[0]?.message ?? v.help,
    });
}
test.afterEach(() => {
  expect(found, "axe violations").toEqual([]);
  found.length = 0;
});
test("main views have no automated WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await scan(page, "home");
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await scan(page, "layers panel");
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Neighbourhood", exact: true })
    .click();
  await expect(page.locator("#area-legend")).toBeVisible();
  await scan(page, "neighbourhood legend");
  await page.getByRole("button", { name: "Flood", exact: true }).click();
  await expect(page.locator("#flood-legend")).toBeVisible();
  await scan(page, "flood legend");
  await page.getByRole("button", { name: "Schools", exact: true }).click();
  await expect(page.locator("#schools-heading")).toBeVisible();
  await scan(page, "schools panel");
  await page.getByRole("button", { name: "Sold prices", exact: true }).click();
  await expect(page.locator("#sold-query")).toBeVisible();
  await scan(page, "sold prices panel");
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "Sources & notes" }).click();
  await scan(page, "sources dialog");
  await page.getByRole("button", { name: "Close sources" }).click();
});
test("building panel with every context section has no violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.getByRole("combobox").fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator("#property-heading")).toHaveText(
    "Reading Town Hall",
  );
  for (const id of ["area-context", "schools-context", "flood-context"]) {
    const summary = page.locator(`#${id} > summary`);
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
  }
  await expect(page.locator("#flood-context-body")).toContainText("flood");
  await expect(
    page.locator("#schools-context-body .school-record"),
  ).toHaveCount(5);
  await scan(page, "building panel");
});
