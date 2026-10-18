/**
 * Real-world load measurements against a deployed (or previewed) readmove.
 *   npx tsx scripts/measure/perf.ts [url] [runs]
 * Chromium runs under three profiles; Firefox and WebKit run unthrottled for
 * timing comparison. Results are medians of `runs` fresh sessions, written to
 * raw/measure/perf.json (ignored). Production builds expose no test hooks, so
 * every signal comes from the network log, paint timing and long tasks.
 */
import { mkdir, writeFile } from "node:fs/promises";
import {
  chromium,
  devices,
  firefox,
  webkit,
  type Browser,
  type Page,
} from "@playwright/test";

const url = process.argv[2] ?? "https://readmove.reading-maps.workers.dev/";
const runs = Number(process.argv[3] ?? 3);
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

interface Profile {
  name: string;
  engine: "chromium" | "firefox" | "webkit";
  device?: string;
  cpu?: number;
  network?: { down: number; up: number; latency: number }; // bytes/s, ms
}
const profiles: Profile[] = [
  { name: "desktop unthrottled", engine: "chromium" },
  // Lighthouse "slow 4G": 1.6 Mbit/s down, 150 ms RTT, 4x CPU slowdown.
  {
    name: "phone slow 4G (Pixel 7, 4x CPU)",
    engine: "chromium",
    device: "Pixel 7",
    cpu: 4,
    network: { down: 200_000, up: 93_750, latency: 150 },
  },
  // Faster mid-range phone: ~9 Mbit/s, 4x CPU.
  {
    name: "phone fast 4G (Pixel 7, 4x CPU)",
    engine: "chromium",
    device: "Pixel 7",
    cpu: 4,
    network: { down: 1_125_000, up: 375_000, latency: 60 },
  },
  { name: "Firefox desktop", engine: "firefox" },
  { name: "WebKit iPhone 15", engine: "webkit", device: "iPhone 15" },
];
const launchers = { chromium, firefox, webkit };

async function observe(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__long = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__long.push([e.startTime, e.duration]);
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
}
const blocking = (page: Page, from: number) =>
  page.evaluate(
    (t) =>
      ((window as any).__long as [number, number][])
        .filter(([s]) => s >= t)
        .reduce((n, [, d]) => n + Math.max(0, d - 50), 0),
    from,
  );
const now = (page: Page) => page.evaluate(() => performance.now());

async function one(browser: Browser, profile: Profile) {
  const context = await browser.newContext(
    profile.device
      ? { ...devices[profile.device] }
      : { viewport: { width: 1440, height: 1000 } },
  );
  const page = await context.newPage();
  await observe(page);
  const sizes = new Map<string, number>();
  let cdp;
  if (profile.engine === "chromium") {
    cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (profile.network)
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: profile.network.down,
        uploadThroughput: profile.network.up,
        latency: profile.network.latency,
      });
    if (profile.cpu)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    const names = new Map<string, string>();
    cdp.on("Network.responseReceived", (e: any) =>
      names.set(e.requestId, e.response.url),
    );
    cdp.on("Network.loadingFinished", (e: any) => {
      const u = names.get(e.requestId);
      if (u) sizes.set(u, e.encodedDataLength);
    });
  }
  const result: Record<string, number | string> = {};
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  await page.locator("#map[data-ready='true']").waitFor({ timeout: 180_000 });
  result.mapReadyMs = Date.now() - t0;
  result.firstContentfulPaintMs = Math.round(
    await page.evaluate(
      () =>
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        -1,
    ),
  );
  result.blockingToReadyMs = Math.round(await blocking(page, 0));
  if (cdp) {
    result.transferredKBAtReady = Math.round(
      [...sizes.values()].reduce((a, b) => a + b, 0) / 1024,
    );
    const heap = await cdp
      .send("Performance.getMetrics")
      .catch(() => undefined);
  }
  // Optional layers: time from click to data downloaded, then to a settled main thread.
  for (const [label, name, asset] of [
    ["flood", "Flood", "flood-zones"],
    ["schools", "Schools", "schools.v1"],
    ["neighbourhood", "Neighbourhood", "neighbourhoods"],
  ] as const) {
    const start = await now(page);
    const t = Date.now();
    const response = page.waitForResponse((r) => r.url().includes(asset), {
      timeout: 180_000,
    });
    await page.getByRole("button", { name, exact: true }).click();
    await (await response).finished();
    result[`${label}DownloadMs`] = Date.now() - t;
    await page.waitForTimeout(2500); // let parsing, geojson tiling and painting settle
    result[`${label}BlockingMs`] = Math.round(await blocking(page, start));
    const entry = [...sizes.entries()].find(([u]) => u.includes(asset));
    if (entry) result[`${label}KB`] = Math.round(entry[1] / 1024);
  }
  if (cdp) {
    const metrics = (await cdp.send("Performance.getMetrics")) as any;
    const heap = metrics.metrics?.find(
      (m: any) => m.name === "JSHeapUsedSize",
    )?.value;
    if (heap) result.jsHeapMB = Math.round(heap / 1048576);
  }
  await context.close();
  return result;
}

const report: Record<string, Record<string, number | string>> = {};
const only = process.env.PROFILES?.split(",");
await mkdir("raw/measure", { recursive: true });
for (const profile of profiles) {
  if (only && !only.some((name) => profile.name.includes(name))) continue;
  const executablePath =
    profile.engine === "chromium"
      ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      : undefined;
  let browser: Browser;
  try {
    browser = await launchers[profile.engine].launch({
      executablePath,
      args:
        profile.engine === "chromium"
          ? [
              "--use-gl=angle",
              "--use-angle=swiftshader",
              "--enable-unsafe-swiftshader",
            ]
          : undefined,
    });
  } catch (error) {
    // e.g. Playwright's Firefox build cannot start on some macOS releases.
    report[profile.name] = {
      launchFailed: (error as Error).message.split("\n")[0],
    };
    console.error(
      profile.name,
      "could not launch:",
      report[profile.name].launchFailed,
    );
    continue;
  }
  const samples: Record<string, number>[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      samples.push((await one(browser, profile)) as Record<string, number>);
    } catch (error) {
      console.error(
        `${profile.name} run ${i + 1} failed:`,
        (error as Error).message.split("\n")[0],
      );
    }
  }
  await browser.close();
  const keys = [...new Set(samples.flatMap((s) => Object.keys(s)))];
  report[profile.name] = Object.fromEntries(
    keys.map((k) => [
      k,
      median(samples.map((s) => s[k]).filter((v) => typeof v === "number")),
    ]),
  );
  report[profile.name].runs = samples.length;
  console.log(profile.name, report[profile.name]);
}
await mkdir("raw/measure", { recursive: true });
await writeFile(
  "raw/measure/perf.json",
  JSON.stringify(
    { url, runs, date: new Date().toISOString(), report },
    null,
    2,
  ) + "\n",
);
