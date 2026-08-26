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
  await expect(page.getByText(/Break: 0h 35m/)).toBeVisible();

  await page.getByRole("button", { name: "Clock in" }).click();
  await page.getByRole("button", { name: "Finish shift" }).click();
  await page.getByRole("button", { name: "Confirm finish" }).click();
  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();
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
