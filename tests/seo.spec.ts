import { expect, test } from "@playwright/test";

const site = "https://d16acm1lzz4dn2.cloudfront.net/";
const repository = "https://github.com/alejo-valencia/blobnoise";

test.describe("crawlable studio", () => {
  test.use({ javaScriptEnabled: false });

  test("serves meaningful HTML, canonical metadata and accurate structured data without JavaScript", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const html = await response!.text();
    expect(html).toContain("Perlin noise texture and 3D sphere generator");
    expect(html).toContain(repository);
    await expect(page).toHaveTitle("blobnoise | Perlin Noise Texture & 3D Sphere Generator");
    await expect(page.getByRole("heading", { name: "blobnoise", exact: true })).toBeVisible();
    await expect(page.locator(".site-info")).toBeVisible();
    await expect(page.locator(".site-info")).toContainText("WebP images or WebM loops");
    await expect(page.getByRole("link", { name: "Source code on GitHub", exact: true })).toHaveAttribute("href", repository);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", site);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow,max-image-preview:large");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", site);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${site}og-image.png`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const structured = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(structured["@type"]).toBe("WebApplication");
    expect(structured.url).toBe(site);
    expect(structured.sameAs).toBe(repository);
    expect(structured.isAccessibleForFree).toBe(true);
    expect(structured).not.toHaveProperty("aggregateRating");
    expect(structured).not.toHaveProperty("review");
  });
});

test("publishes crawl directives, the canonical sitemap and real social assets", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${site}sitemap.xml`);
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).not.toMatch(/^Disallow:\s*\/\s*$/m);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  expect(xml.match(/<loc>/g)).toHaveLength(1);
  expect(xml).toContain(`<loc>${site}</loc>`);
  for (const [path, width, height] of [
    ["/og-image.png", 1200, 630],
    ["/apple-touch-icon.png", 180, 180],
  ] as const) {
    const image = await request.get(path);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    const bytes = await image.body();
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  }
  const missing = await request.get("/404.html");
  expect(await missing.text()).toContain('name="robots" content="noindex"');
});

test("links the editor header directly to the personal GitHub repository", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View source on GitHub", exact: true }))
    .toHaveAttribute("href", repository);
  await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeEnabled();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("link", { name: "View source on GitHub", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
