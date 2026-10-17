import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const locations = JSON.parse(
  readFileSync("public/data/sale-locations.v2.json", "utf8"),
);
const sales = JSON.parse(
  readFileSync("public/data/sales-2025.v1.json", "utf8"),
);
test("comparison sorting, reset and history preserve selection and camera", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.locator("#sold-open").click();
  await page.locator("#sold-query").fill("RG1 4PF");
  await page
    .getByRole("button", { name: "Show mapped sale", exact: true })
    .click();
  await expect(page.locator("#sold-count")).toHaveText(
    "5 nearby sales · showing 5",
  );
  await page.locator("#sold-history > summary").click();
  await expect(page.locator("#sold-history")).toContainText(
    "No other same-UPRN transactions",
  );
  await page.waitForTimeout(800);
  const camera = await page.evaluate(
    () => (window as any).__readmove.snapshot().camera,
  );
  await page.locator("#sold-sort").selectOption("price-low");
  const prices = await page
    .locator("#sold-results .sold-record > strong")
    .allTextContents();
  const values = prices.map((p) => Number(p.replace(/[^0-9]/g, "")));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await page.locator("#sold-type").selectOption("flat");
  await page.locator("#sold-radius").selectOption("250");
  await expect(page.locator("#sold-results")).toContainText(
    "zero results do not mean no nearby sales occurred",
  );
  await expect(page.locator("#sold-active-filters")).toContainText(
    "Flat / maisonette · Category A · Within 250 m",
  );
  await page.locator("#sold-reset").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sold-count")).toHaveText(
    "5 nearby sales · showing 5",
  );
  await expect(page.locator("#sold-sort")).toHaveValue("price-low");
  await expect(page.locator("#sold-heading")).toContainText("GLENEAGLES COURT");
  expect(
    await page.evaluate(() => (window as any).__readmove.snapshot().camera),
  ).toEqual(camera);
  await expect(page.locator("#sold-reset")).toBeFocused();
  await page.screenshot({ path: info.outputPath("stage-eight-filters.png") });
  await page.locator("#sold-fit").click();
  await page.waitForTimeout(800);
  await page.locator("#sold-back").click();
  await expect(page.locator("#sold-sort")).toHaveValue("newest");
  await page.locator("#sold-query").fill("unlikely-address-xyz");
  await page.locator("#sold-reset").click();
  await expect(page.locator("#sold-query")).toHaveValue("");
  await page.locator("#sold-close").click();
  await expect(page.locator("#official-sales")).toBeHidden();
});
test("repeated-UPRN history shows both transactions and remains independent of filters", async ({
  page,
}, info) => {
  const pair = locations.identifiers.find(
    (i: any) =>
      locations.identifiers.filter((j: any) => j.uprn === i.uprn).length === 2,
  );
  const record = sales.records.find((s: any) => s.id === pair.transactionId);
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  await page.locator("#sold-open").click();
  await page.locator("#sold-category").selectOption("");
  await page.locator("#sold-query").fill(record.address.postcode);
  await page.locator(`[data-sale="${record.id}"]`).click();
  await page.locator("#sold-history > summary").click();
  await expect(page.locator("#sold-history .sold-record")).toHaveCount(2);
  await page.locator("#sold-since").fill("2026-01-01");
  await page.locator("#sold-since").dispatchEvent("change");
  await expect(page.locator("#sold-count")).toHaveText(
    "0 nearby sales · showing 0",
  );
  await expect(page.locator("#sold-history .sold-record")).toHaveCount(2);
  await page.locator("#sold-history").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("stage-eight-history.png") });
  const close = await page.locator("#sold-close").boundingBox();
  expect(close!.y).toBeGreaterThanOrEqual(0);
  expect(close!.y + close!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#sold-close").click();
});
