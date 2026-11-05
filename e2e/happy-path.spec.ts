import { expect, test } from "@playwright/test";

test("sign in, encode a source and see its renditions", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);

  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  const title = `E2E encode ${Date.now()}`;
  await page.getByLabel("Source URL").fill("https://cdn.example.com/videos/e2e.mp4");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create job" }).click();

  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Start encode" }).click();

  await expect(page.getByText("job queued")).toBeVisible();
  await expect(page.getByText("done, 4 renditions ready")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("row", { name: /1080p\s+1920×1080/ })).toBeVisible();

  await page.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(page.getByRole("link", { name: title })).toContainText("COMPLETED");
});
