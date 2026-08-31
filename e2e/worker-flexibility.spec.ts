import { expect, test } from "@playwright/test";
import { expectCsrfOnWrites, expectNoExternalRequests, installWorkerApi } from "./support/mockApi";

test.use({ viewport: { width: 390, height: 844 } });

test("worker creates a project, takes multiple breaks and completes two shifts without a photo", async ({ context, page }) => {
  const api = await installWorkerApi(context);

  await page.goto("/");
  await expect(page.getByText("My shift", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Add Project" }).click();
  const dialog = page.getByRole("dialog", { name: "New Project" });
  await dialog.locator("input").fill("Worker Site");
  await dialog.locator("textarea").fill("Project created from the worker mobile flow");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Project created and selected");
  const projectCall = api.calls.find((call) => call.path === "/api/worker/projects");
  expect(projectCall?.body).toEqual({
    name: "Worker Site",
    description: "Project created from the worker mobile flow",
  });

  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByText("On break", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "End break" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start break" }).click();
  await page.getByRole("button", { name: "End break" }).click();

  await page.getByRole("button", { name: "Finish shift" }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();
  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();
  await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText(/Break: 0h 35m/)).toBeVisible();

  await page.getByRole("button", { name: "Live Today", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Clock in" }).click();
  await page.getByRole("button", { name: "Finish shift" }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();
  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();
  await page.getByRole("button", { name: "Hours overview", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("1h 25m", { exact: true }).first()).toBeVisible();

  const shiftCalls = api.calls.filter((call) => call.path === "/api/shift/action");
  expect(shiftCalls.map((call) => (call.body as { action: string }).action)).toEqual([
    "clock_in",
    "start_break",
    "end_break",
    "start_break",
    "end_break",
    "clock_out",
    "clock_in",
    "clock_out",
  ]);
  expect(shiftCalls.every((call) => !("photo" in (call.body as Record<string, unknown>)))).toBe(true);
  expect(shiftCalls.every((call) => typeof (call.body as { location?: unknown }).location === "object")).toBe(true);
  expect(api.completedShiftCount()).toBe(2);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);

  const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasPageOverflow).toBe(false);
});

test("client fails closed when the CSRF cookie is missing", async ({ context, page }) => {
  const api = await installWorkerApi(context);
  await context.clearCookies();

  await page.goto("/");
  await page.getByRole("button", { name: "Add Project" }).click();
  const dialog = page.getByRole("dialog", { name: "New Project" });
  await dialog.locator("input").fill("Blocked Project");
  await dialog.locator("textarea").fill("This write must never reach the API");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog.getByText("Your session security token is missing. Sign in again.")).toBeVisible();
  expect(api.calls.filter((call) => call.method === "POST")).toEqual([]);
  expectNoExternalRequests(api);
});

test("worker can finish an open shift recovered from the previous work date", async ({ context, page }) => {
  const api = await installWorkerApi(context, { overnightOpenShift: true });

  await page.goto("/");
  await expect(page.getByText("Working", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Finish shift" }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();

  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();
  const shiftCalls = api.calls.filter((call) => call.path === "/api/shift/action");
  expect(shiftCalls.map((call) => (call.body as { action: string }).action)).toEqual(["clock_out"]);
  expect(api.completedShiftCount()).toBe(1);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("lost clock-out response is queued and retried with the same action", async ({ context, page }) => {
  const api = await installWorkerApi(context, { failFirstClockOutNetwork: true });

  await page.goto("/");
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Finish shift" }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();

  await expect(page.getByText(/Synced 1 offline action/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fh_offline_action_queue"))).toBeNull();

  const clockOutCalls = api.calls.filter((call) => (
    call.path === "/api/shift/action"
    && (call.body as { action?: string }).action === "clock_out"
  ));
  expect(clockOutCalls).toHaveLength(2);
  expect((clockOutCalls[0].body as { idempotencyKey: string }).idempotencyKey)
    .toBe((clockOutCalls[1].body as { idempotencyKey: string }).idempotencyKey);
  expect(api.completedShiftCount()).toBe(1);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("worker sees an administrator adjustment notice and the updated payroll labels", async ({ context, page }) => {
  const api = await installWorkerApi(context, { adjustedHistory: true });

  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("Hours modified by an administrator", { exact: true })).toBeVisible();
  await expect(page.getByText(/Worker forgot to clock out at the end of the shift\./)).toBeVisible();
  await page.getByRole("button", { name: "Hours overview", exact: true }).filter({ visible: true }).click();
  await expect(page.getByLabel(/Tax Reference \(ITIS\)/)).toBeVisible();
  await expect(page.getByLabel(/Social Security Number/)).toHaveCount(1);
  await expect(page.getByLabel("Social Reference", { exact: true })).toHaveCount(0);
  expectNoExternalRequests(api);
});

test("worker sees the mandatory description for an admin-created workday with readable contrast", async ({ context, page }) => {
  const api = await installWorkerApi(context, { adminCreatedHistory: true });

  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).filter({ visible: true }).click();
  const heading = page.getByText("Workday added by an administrator", { exact: true });
  await expect(heading).toBeVisible();
  await expect(page.getByText(/Approved paper timesheet for site work\./)).toBeVisible();

  const notice = heading.locator("..");
  const contrast = await notice.evaluate((element) => {
    const textStyle = getComputedStyle(element).color;
    const backgroundStyle = getComputedStyle(element).backgroundColor;
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const text = parse(textStyle);
    const rawBackground = parse(backgroundStyle);
    let ancestor = element.parentElement;
    let parentStyle = "rgb(255, 255, 255)";
    while (ancestor) {
      const candidate = getComputedStyle(ancestor).backgroundColor;
      const parsed = parse(candidate);
      if ((parsed[3] ?? 1) === 1) {
        parentStyle = candidate;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    const parentBackground = parse(parentStyle);
    const alpha = rawBackground[3] ?? 1;
    const background = rawBackground.slice(0, 3).map((channel, index) => (
      channel * alpha + (parentBackground[index] ?? 255) * (1 - alpha)
    ));
    const luminance = (rgb: number[]) => {
      const linear = rgb.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const lighter = Math.max(luminance(text), luminance(background));
    const darker = Math.min(luminance(text), luminance(background));
    return {
      ratio: (lighter + 0.05) / (darker + 0.05),
      textStyle,
      backgroundStyle,
      parentStyle,
    };
  });
  expect(contrast.ratio, JSON.stringify(contrast)).toBeGreaterThanOrEqual(4.5);
  expectNoExternalRequests(api);
});
