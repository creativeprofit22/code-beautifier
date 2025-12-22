import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Next.js/i);
  });

  test("should have main content", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
