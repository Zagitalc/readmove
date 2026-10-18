import type { Position } from "./types";

/**
 * British National Grid → WGS84 with the standard 7-parameter Helmert shift.
 * Accuracy is a few metres (OSTN15 would be needed for better); fine for
 * point-of-interest markers, not for survey work.
 */
const rad = Math.PI / 180;
const airy = { a: 6377563.396, b: 6356256.909 };
const wgs84 = { a: 6378137, b: 6356752.3142 };
const F0 = 0.9996012717,
  lat0 = 49 * rad,
  lon0 = -2 * rad,
  N0 = -100000,
  E0 = 400000;

function meridianArc(lat: number, n: number, b: number): number {
  const n2 = n * n,
    n3 = n2 * n;
  return (
    b *
    F0 *
    ((1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0) -
      (3 * n + 3 * n2 + (21 / 8) * n3) *
        Math.sin(lat - lat0) *
        Math.cos(lat + lat0) +
      (15 / 8) *
        (n2 + n3) *
        Math.sin(2 * (lat - lat0)) *
        Math.cos(2 * (lat + lat0)) -
      (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0)))
  );
}
/** Latitude/longitude in radians on the OSGB36 (Airy 1830) datum. */
export function bngToOsgb36(easting: number, northing: number): Position {
  const { a, b } = airy;
  const e2 = 1 - (b * b) / (a * a),
    n = (a - b) / (a + b);
  let lat = lat0,
    M = 0;
  do {
    lat = (northing - N0 - M) / (a * F0) + lat;
    M = meridianArc(lat, n, b);
  } while (Math.abs(northing - N0 - M) >= 1e-5);
  const s = Math.sin(lat),
    c = Math.cos(lat),
    t = Math.tan(lat);
  const nu = (a * F0) / Math.sqrt(1 - e2 * s * s);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5);
  const eta2 = nu / rho - 1;
  const dE = easting - E0;
  const VII = t / (2 * rho * nu);
  const VIII =
    (t / (24 * rho * nu ** 3)) * (5 + 3 * t * t + eta2 - 9 * t * t * eta2);
  const IX = (t / (720 * rho * nu ** 5)) * (61 + 90 * t * t + 45 * t ** 4);
  const X = 1 / (c * nu);
  const XI = (1 / (6 * c * nu ** 3)) * (nu / rho + 2 * t * t);
  const XII = (1 / (120 * c * nu ** 5)) * (5 + 28 * t * t + 24 * t ** 4);
  const XIIA =
    (1 / (5040 * c * nu ** 7)) *
    (61 + 662 * t * t + 1320 * t ** 4 + 720 * t ** 6);
  return [
    lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7,
    lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6,
  ];
}
export function bngToWgs84(easting: number, northing: number): Position {
  const [lon, lat] = bngToOsgb36(easting, northing);
  const { a, b } = airy;
  const e2 = 1 - (b * b) / (a * a);
  const nu = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const x1 = nu * Math.cos(lat) * Math.cos(lon),
    y1 = nu * Math.cos(lat) * Math.sin(lon),
    z1 = nu * (1 - e2) * Math.sin(lat);
  // OSGB36 → WGS84 (Ordnance Survey, "A guide to coordinate systems in Great Britain").
  const tx = 446.448,
    ty = -125.157,
    tz = 542.06,
    s = -20.4894e-6,
    rx = (0.1502 / 3600) * rad,
    ry = (0.247 / 3600) * rad,
    rz = (0.8421 / 3600) * rad;
  const x2 = tx + (1 + s) * x1 - rz * y1 + ry * z1,
    y2 = ty + rz * x1 + (1 + s) * y1 - rx * z1,
    z2 = tz - ry * x1 + rx * y1 + (1 + s) * z1;
  const e2w = 1 - (wgs84.b * wgs84.b) / (wgs84.a * wgs84.a);
  const p = Math.hypot(x2, y2);
  let phi = Math.atan2(z2, p * (1 - e2w));
  for (let i = 0; i < 10; i++) {
    const nuw = wgs84.a / Math.sqrt(1 - e2w * Math.sin(phi) ** 2);
    phi = Math.atan2(z2 + e2w * nuw * Math.sin(phi), p);
  }
  return [Math.atan2(y2, x2) / rad, phi / rad];
}
