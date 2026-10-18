import { test, expect } from "@playwright/test";

test("schools load on demand, filter, highlight and appear in building context", async ({
  page,
}, info) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  expect(requests.some((url) => url.includes("schools.v1"))).toBe(false);

  await page.getByRole("button", { name: "Schools", exact: true }).click();
  const panel = page.getByRole("region", { name: "Schools", exact: true });
  await expect(panel).toContainText("Schools in the map area");
  await expect(panel).toContainText("not a route, catchment or admission");
  await expect(panel).toContainText("No inspection ratings");
  await expect(page.locator("#schools-count")).toContainText("of 151 schools");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__readmove.snapshot().schoolsLoaded),
    )
    .toBe(151);
  expect(
    await page.evaluate(
      () => (window as any).__readmove.snapshot().schoolsVisible,
    ),
  ).toBe("visible");

  await page.locator("#schools-phase").selectOption("Secondary");
  await expect(page.locator("#schools-count")).toHaveText(
    /^\d+ of 151 schools$/,
  );
  await expect(page.locator("#schools-count")).not.toHaveText(/^151 of/);
  await page.locator("#schools-phase").selectOption("");
  await page.locator("#schools-query").fill("rg1 5lw");
  await expect(page.locator(".school-record")).toHaveCount(1);
  await expect(page.locator(".school-record")).toContainText("Reading School");
  await expect(page.locator(".school-record")).toContainText("ages 11–18");
  const before = await page.evaluate(
    () => (window as any).__readmove.snapshot().camera.centre,
  );
  await page.getByRole("button", { name: "Show on map" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__readmove.snapshot().camera.centre[0],
      ),
    )
    .not.toBe(before[0]);
  await expect(page.locator(".school-record.selected")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("stage-ten-panel.png") });
  await page.locator("#schools-query").fill("zzzz-no-school");
  await expect(page.locator("#schools-panel")).toContainText(
    "No schools match",
  );

  await page.getByRole("button", { name: "Close schools" }).click();
  await expect(page.locator("#schools-panel")).toBeHidden();
  await page.getByRole("button", { name: "Explore", exact: true }).click();

  await page.getByRole("combobox").fill("Town Hall");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator("#property-heading")).toHaveText(
    "Reading Town Hall",
  );
  const summary = page.locator("#schools-context > summary");
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await page.keyboard.press("Enter");
  const body = page.locator("#schools-context-body");
  await expect(body.locator(".school-record")).toHaveCount(5);
  await expect(body).toContainText("straight-line");
  await expect(body).toContainText("Nearby does not mean a child can attend");
  await expect(
    body.locator("a[href^='https://get-information-schools']").first(),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("stage-ten-context.png") });
});

test("the nav highlights only the open panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map")).toHaveAttribute("data-ready", "true");
  const pressed = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await pressed("Schools").click();
  await expect(pressed("Schools")).toHaveAttribute("aria-pressed", "true");
  await pressed("Sold prices").click();
  await expect(pressed("Sold prices")).toHaveAttribute("aria-pressed", "true");
  await expect(pressed("Schools")).toHaveAttribute("aria-pressed", "false");
  await expect(pressed("Explore")).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Close sold prices" }).click();
  await expect(pressed("Sold prices")).toHaveAttribute("aria-pressed", "false");
  await expect(pressed("Explore")).toHaveAttribute("aria-pressed", "true");
});
