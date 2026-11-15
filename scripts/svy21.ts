// SVY21 (EPSG:3414) to WGS84, Transverse Mercator series (SLA published formulae).
const a = 6378137;
const f = 1 / 298.257223563;
const rad = Math.PI / 180;
const oLat = 1.366666 * rad;
const oLon = 103.833333 * rad;
const oN = 38744.572;
const oE = 28001.642;
const k = 1;

const e2 = 2 * f - f * f;
const e4 = e2 * e2;
const e6 = e4 * e2;
const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
const A2 = (3 / 8) * (e2 + e4 / 4 + (15 * e6) / 128);
const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
const A6 = (35 * e6) / 3072;
const M = (lat: number) => a * (A0 * lat - A2 * Math.sin(2 * lat) + A4 * Math.sin(4 * lat) - A6 * Math.sin(6 * lat));
const Mo = M(oLat);
const b = a * (1 - f);
const n = (a - b) / (a + b);
const n2 = n * n;
const n3 = n2 * n;
const n4 = n3 * n;
const G = a * (1 - n) * (1 - n2) * (1 + (9 * n2) / 4 + (225 * n4) / 64) * rad;

/** `easting` = x_coord, `northing` = y_coord. Returns [lon, lat] in degrees. */
export function svy21ToWgs84(easting: number, northing: number): [number, number] {
  const sigma = ((northing - oN + Mo) / k / G) * rad;
  const latP =
    sigma +
    ((3 * n) / 2 - (27 * n3) / 32) * Math.sin(2 * sigma) +
    ((21 * n2) / 16 - (55 * n4) / 32) * Math.sin(4 * sigma) +
    ((151 * n3) / 96) * Math.sin(6 * sigma) +
    ((1097 * n4) / 512) * Math.sin(8 * sigma);
  const s = Math.sin(latP);
  const rho = (a * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5);
  const v = a / Math.sqrt(1 - e2 * s * s);
  const psi = v / rho;
  const psi2 = psi * psi;
  const psi3 = psi2 * psi;
  const psi4 = psi3 * psi;
  const t = Math.tan(latP);
  const t2 = t * t;
  const t4 = t2 * t2;
  const t6 = t4 * t2;
  const dE = easting - oE;
  const x = dE / (k * v);
  const x3 = x ** 3;
  const x5 = x ** 5;
  const x7 = x ** 7;
  const lf = t / (k * rho);
  const lat =
    latP -
    lf * ((dE * x) / 2) +
    lf * ((dE * x3) / 24) * (-4 * psi2 + 9 * psi * (1 - t2) + 12 * t2) -
    lf * ((dE * x5) / 720) * (8 * psi4 * (11 - 24 * t2) - 12 * psi3 * (21 - 71 * t2) + 15 * psi2 * (15 - 98 * t2 + 15 * t4) + 180 * psi * (5 * t2 - 3 * t4) + 360 * t4) +
    lf * ((dE * x7) / 40320) * (1385 + 3633 * t2 + 4095 * t4 + 1575 * t6);
  const c = Math.cos(latP);
  const lon =
    oLon +
    x / c -
    (x3 / (6 * c)) * (psi + 2 * t2) +
    (x5 / (120 * c)) * (-4 * psi3 * (1 - 6 * t2) + psi2 * (9 - 68 * t2) + 72 * psi * t2 + 24 * t4) -
    (x7 / (5040 * c)) * (61 + 662 * t2 + 1320 * t4 + 720 * t6);
  return [lon / rad, lat / rad];
}
