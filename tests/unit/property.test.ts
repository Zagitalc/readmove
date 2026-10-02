import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildingTitle,
  comparableSales,
  createDemo,
  findBuilding,
  parseGeography,
  parseTransactions,
} from "../../src/property/data";
import { heightLabel, provenanceHtml } from "../../src/ui/details";
import { escapeHtml } from "../../src/ui/shell";

const geography = parseGeography(
  JSON.parse(readFileSync("public/data/geography.v2.json", "utf8")),
);
const demo = createDemo(geography.buildings);
describe("property identity and transaction boundaries", () => {
  it("keeps transaction IDs, property references and OSM IDs separate", () => {
    expect(demo.locations[0].id).not.toBe(demo.buildingId);
    expect(
      demo.locations.every((p) => p.match === "manual-fixture" && !p.uprn),
    ).toBe(true);
    expect(
      demo.transactions.every((t) => t.provenance.quality === "fixture"),
    ).toBe(true);
    expect(findBuilding(geography.buildings, demo.buildingId)?.id).toBe(
      demo.buildingId,
    );
    expect(findBuilding(geography.buildings, "not-a-building")).toBeUndefined();
  });
  it("rejects malformed dates, nonpositive prices, strings, missing provenance and duplicate transactions", () => {
    const original = demo.transactions[0];
    for (const patch of [
      { price: -1 },
      { price: "300000" },
      { date: "2025-02-30" },
      { provenance: undefined },
      { propertyRef: "" },
    ]) {
      expect(() => parseTransactions([{ ...original, ...patch }])).toThrow();
    }
    expect(() => parseTransactions([original, original])).toThrow("Duplicate");
  });
  it("excludes the selected property and enforces the comparable radius", () => {
    const results = comparableSales(
      demo.locations[0],
      demo.locations,
      demo.transactions,
    );
    expect(results).toHaveLength(2);
    expect(results.every((t) => t.propertyRef !== demo.locations[0].id)).toBe(
      true,
    );
    expect(
      comparableSales(demo.locations[0], demo.locations, demo.transactions, 1),
    ).toEqual([]);
  });
  it("distinguishes estimated, tagged and level-derived height", () => {
    expect(
      heightLabel({ ...geography.buildings[0], heightSource: "estimated" }),
    ).toBe("Estimated building height");
    expect(
      heightLabel({ ...geography.buildings[0], heightSource: "measured" }),
    ).toBe("Mapped height");
    expect(
      heightLabel({ ...geography.buildings[0], heightSource: "levels" }),
    ).toContain("storeys");
  });
  it("renders sources, dates and fixture status, escaping provider text and unsafe URLs", () => {
    const html = provenanceHtml(demo.transactions[0].provenance);
    expect(html).toContain("FICTIONAL DEVELOPMENT DATA");
    expect(html).toContain("2026-10-02");
    expect(
      provenanceHtml({
        ...geography.provenance,
        source: "<script>",
        url: "javascript:alert(1)",
      }),
    ).not.toContain("href=");
    expect(escapeHtml('<img onerror="evil">')).toBe(
      "&lt;img onerror=&quot;evil&quot;&gt;",
    );
    expect(
      buildingTitle({
        ...geography.buildings[0],
        address: undefined,
        name: undefined,
        kind: "yes",
      }),
    ).toBe("Mapped building");
  });
});
