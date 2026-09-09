import { expect, test } from "@playwright/test";
import { expectCsrfOnWrites, expectNoExternalRequests, installAdminApi } from "./support/mockApi";

test.use({ viewport: { width: 390, height: 844 } });

test("admin creates a complete workday with a required employee-visible description", async ({ context, page }) => {
  const api = await installAdminApi(context);

  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();

  const addButton = page.getByRole("button", { name: "Add workday", exact: true });
  await expect(addButton).toBeEnabled();
  await addButton.click();

  const dialog = page.getByRole("dialog", { name: "Create workday hours" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Worker *" }).selectOption("worker-1");
  await dialog.getByRole("combobox", { name: "Project / Site (optional)" }).selectOption("project-1");
  const description = dialog.getByRole("textbox", { name: "Workday description *" });
  await expect(description).toHaveAttribute("required", "");
  await description.fill("Approved paper timesheet for site work.");
  await dialog.getByRole("button", { name: "Save Workday" }).click();

  await expect(page.getByRole("status")).toContainText("Workday created successfully");
  await expect(page.getByText("Worker Test", { exact: true }).filter({ visible: true }).last()).toBeVisible();

  const createCall = api.calls.find((call) => call.method === "POST" && call.path === "/api/admin/shifts/create");
  expect(createCall?.body).toMatchObject({
    userId: "worker-1",
    projectId: "project-1",
    description: "Approved paper timesheet for site work.",
  });
  expect(Date.parse((createCall?.body as { clockInAt: string }).clockInAt)).not.toBeNaN();
  expect(Date.parse((createCall?.body as { clockOutAt: string }).clockOutAt)).not.toBeNaN();
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);

  const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasPageOverflow).toBe(false);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`adjustment preserves organization time on a UTC device at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport, timezoneId: "UTC", locale: "en-GB", serviceWorkers: "block" });
    const api = await installAdminApi(context, { denseData: true });
    const page = await context.newPage();
    await page.goto("/?section=history");
    await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();
    const adjust = page.getByRole("button", { name: "Adjust", exact: true }).filter({ visible: true }).first();
    await adjust.click();
    const dialog = page.getByRole("dialog", { name: "Adjust Shift Times" });
    const inDate = dialog.getByLabel("Clock In Time: Date", { exact: true });
    const inTime = dialog.getByLabel("Clock In Time: Time", { exact: true });
    const outTime = dialog.getByLabel("Clock Out Time: Time", { exact: true });
    await expect(inDate).toHaveValue("2026-08-24");
    await expect(inTime).toHaveValue("09:00");
    await expect(outTime).toHaveValue("17:30");
    await expect(dialog.getByText("Europe/Jersey", { exact: true })).toBeVisible();
    const sizes = await dialog.locator("input, textarea, button").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, font: parseFloat(getComputedStyle(element).fontSize), tag: element.tagName };
    }));
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
      if (size.tag !== "BUTTON") expect(size.font).toBeGreaterThanOrEqual(16);
    }
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath("adjust-mobile.png") });
    await dialog.getByRole("textbox", { name: "Reason for Adjustment *" }).fill("Confirmed recorded times.");
    await dialog.getByRole("button", { name: "Save Adjustment" }).click();
    await expect(dialog).toBeHidden();
    const saved = api.calls.find((call) => call.path === "/api/admin/shifts/adjust");
    expect(saved?.body).toMatchObject({ clockInAt: "2026-08-24T08:00:00.000Z", clockOutAt: "2026-08-24T16:30:00.000Z" });
    await adjust.click();
    await inTime.fill("10:15");
    await outTime.fill("09:00");
    await dialog.getByRole("textbox", { name: "Reason for Adjustment *" }).fill("Corrected arrival.");
    await dialog.getByRole("button", { name: "Save Adjustment" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Clock-out time must be after clock-in time");
    expect(api.calls.filter((call) => call.path === "/api/admin/shifts/adjust")).toHaveLength(1);
    await outTime.fill("17:30");
    await dialog.getByRole("button", { name: "Save Adjustment" }).click();
    await expect(dialog).toBeHidden();
    expect(api.calls.filter((call) => call.path === "/api/admin/shifts/adjust").at(-1)?.body).toMatchObject({ clockInAt: "2026-08-24T09:15:00.000Z" });
    await adjust.click();
    await expect(inTime).toHaveValue("10:15");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(adjust).toBeFocused();
    expectCsrfOnWrites(api.calls);
    expectNoExternalRequests(api);
    await context.close();
  });
}

test("Select Period sends inclusive dates, keeps existing filters and blocks reversed ranges", async ({ context, page }, testInfo) => {
  const api = await installAdminApi(context, { denseData: true, filterHistory: true });
  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();
  await page.locator("summary").filter({ hasText: "Filters" }).click();
  const period = page.getByRole("combobox", { name: "Period", exact: true });
  await expect(period.locator("option")).toHaveText(["Today", "This Week", "Last Week", "This Month", "All Records", "Select Period"]);
  await period.selectOption("custom");
  const start = page.getByLabel("Start date", { exact: true });
  const end = page.getByLabel("End date", { exact: true });
  await start.fill("2026-08-23");
  await end.fill("2026-08-24");
  await expect(page.getByTestId("admin-history-record")).toHaveCount(2);
  const latestQuery = () => new URL(api.calls.filter((call) => call.path.startsWith("/api/admin/shifts/history")).at(-1)!.path, "http://test").searchParams;
  expect(latestQuery().get("start_date")).toBe("2026-08-23");
  expect(latestQuery().get("end_date")).toBe("2026-08-24");
  await page.getByRole("combobox", { name: "Worker", exact: true }).selectOption("worker-1");
  await page.getByRole("combobox", { name: "Project / Site", exact: true }).selectOption("project-1");
  await expect(page.getByTestId("admin-history-record")).toHaveCount(1);
  expect(latestQuery().get("user_id")).toBe("worker-1");
  expect(latestQuery().get("project_id")).toBe("project-1");
  await page.screenshot({ path: testInfo.outputPath("period-mobile.png"), fullPage: true });
  await start.fill("2026-08-24");
  await expect(page.getByTestId("admin-history-record")).toHaveCount(1);
  await end.fill("2026-08-22");
  await expect(page.getByRole("alert")).toContainText("End date must be on or after start date");
  await expect(page.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  await end.fill("2026-08-24");
  await expect(page.getByTestId("admin-history-record")).toHaveCount(1);
  await period.selectOption("all");
  await expect(start).toBeHidden();
  await expect.poll(() => latestQuery().has("start_date")).toBe(false);
  expect(latestQuery().get("user_id")).toBe("worker-1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expectNoExternalRequests(api);
});
