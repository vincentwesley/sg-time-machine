import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "/sg-time-machine/";
const STYLE = (bg: string) => JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": bg } }] });

/** Offline-deterministic basemap: stub the style, fail every other tile-host request. */
async function stubTiles(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    const u = route.request().url();
    if (u.includes("/styles/")) return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: STYLE(u.endsWith("/dark") ? "#1b2218" : "#dfeee6") });
    return route.abort();
  });
}
function watchErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}
async function open(page: Page, hash = "", theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch { /* ignore */ } }, theme);
  await stubTiles(page);
  await page.goto(URL + hash);
  await expect(page.locator("#time-label")).not.toHaveText("--:--");
  await page.waitForFunction(() => (document.getElementById("map") as HTMLElement | null)?.dataset.ready === "1");
}
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("loads with a map canvas, archive start and no console errors", async ({ page }) => {
  const errs = watchErrors(page);
  await open(page);
  await expect(page.locator("#map canvas.maplibregl-canvas")).toBeVisible();
  await expect(page.locator("#since")).toContainText("Archive since");
  await expect(page.getByRole("heading", { name: "SG Time Machine", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Credits" })).toBeAttached();
  expect(errs).toEqual([]);
});

test("layer chips toggle and drive the readings panel", async ({ page }) => {
  await open(page);
  const flood = chip(page, "Floods");
  await expect(flood).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#panel-body")).not.toContainText("Flood alerts");
  await flood.click();
  await expect(flood).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#panel-body")).toContainText("Flood alerts");
  await chip(page, "Taxis").click();
  await expect(page.locator("#panel-body")).toContainText("Taxis");
  await chip(page, "PM2.5").click();
  await expect(page.locator("#panel-body th", { hasText: "PM2.5" })).toBeVisible();
  await flood.click();
  await expect(page.locator("#panel-body")).not.toContainText("Flood alerts");
});

test("slider changes the time and the readings; hash is shareable", async ({ page }) => {
  await open(page);
  await expect(page.locator("#time-label")).toContainText("09:00");
  const central = page.locator("#panel-body tbody tr", { hasText: "central" }).locator(".val").first();
  const last = await central.textContent();
  await page.locator("#slider").fill("1"); // 08:00 (06:00 is the dengue-only snapshot)
  await expect(page.locator("#time-label")).toContainText("08:00");
  await expect(central).not.toHaveText(last ?? "");
  await expect(central).toHaveText("33");
  expect(page.url()).toContain("#d=2026-11-15&t=08:00:30");
  await page.goto(URL + "#d=2026-11-15&t=08:30:30&l=psi");
  await expect(page.locator("#time-label")).toContainText("08:30");
  await expect(chip(page, "PSI")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Dengue")).toHaveAttribute("aria-pressed", "false");
});

test("step buttons and play advance the snapshot", async ({ page }) => {
  await open(page, "#d=2026-11-15&t=06:00:30&l=psi,dengue");
  await expect(page.locator("#time-label")).toContainText("06:00");
  await page.getByRole("button", { name: "Next snapshot" }).click();
  await expect(page.locator("#time-label")).toContainText("08:00");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.locator("#time-label")).toContainText("09:00");
});

test("a feed with no file on the chosen day says so", async ({ page }) => {
  await open(page, "#d=2026-11-14&t=12:00:30&l=psi,carpark");
  await expect(page.locator("#panel-body")).toContainText("no snapshot for this feed on this day");
  await expect(page.locator("#panel-body")).toContainText("as of 12:00");
});

test("empty archive shows the start-up state", async ({ page }) => {
  await page.route("**/data/index.json", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ generated: "2026-11-15T00:00:00Z", feeds: {} }) }));
  await stubTiles(page);
  await page.goto(URL);
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#empty")).toContainText("within 30 minutes");
  await expect(page.locator("#slider")).toBeDisabled();
  await expect(page.locator("#map canvas.maplibregl-canvas")).toBeVisible();
});

test("no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page);
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
  expect(w.doc).toBeLessThanOrEqual(w.win);
});

for (const theme of ["dark", "light"] as const) {
  test(`axe has no serious or critical violations (${theme})`, async ({ page }) => {
    await open(page, "", theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const res = await new AxeBuilder({ page }).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });

  for (const [w, h] of [[375, 800], [1280, 800]] as const) {
    test(`screenshot ${theme} ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, "#d=2026-11-15&t=09:00:30&l=dengue,psi,pm25,flood,carpark,taxi", theme);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `qa-output/shot-${theme}-${w}.png` });
      await page.screenshot({ path: `qa-output/full-${theme}-${w}.png`, fullPage: true });
    });
  }
}

test("theme toggle switches to light and back", async ({ page }) => {
  await open(page);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
