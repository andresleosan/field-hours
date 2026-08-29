import { expect, test } from "@playwright/test";
import { expectCsrfOnWrites, expectNoExternalRequests, installAdminApi, installWorkerApi } from "./support/mockApi";

test("admin submits, approves and locks a payroll snapshot without sending payment", async ({ context, page }) => {
  const api = await installAdminApi(context);

  await page.goto("/clock");
  await expect(page.getByRole("heading", { name: "Review and approve payroll" })).toBeVisible();
  await expect(page.getByText("Not submitted", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Submit current preview for approval" }).click();
  await expect(page.getByRole("status")).toContainText("Payroll submitted for administrator approval.");
  await expect(page.getByText("Awaiting review", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Salary Advice" })).toHaveCount(0);

  await page.getByRole("button", { name: "Approve and mark ready" }).click();
  await expect(page.getByRole("status")).toContainText("Payroll approved and marked payment ready.");
  await expect(page.getByText("Payment ready", { exact: true })).toBeVisible();
  await expect(page.getByText("This period is approved and locked. No payment was sent.")).toBeVisible();

  await page.getByRole("button", { name: "Open Salary Advice" }).click();
  await expect(page.getByRole("heading", { name: "Final worker documents" })).toBeVisible();
  await expect(page.getByText("Approved · locked", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prepare Salary Advice" }).click();
  await expect(page.getByText("Prepared for Worker Test", { exact: true })).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / save final Salary Advice" }).click();
  const payslip = await popupPromise;
  await expect(payslip.getByText("Approved · locked snapshot", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Worker <Test>", { exact: true })).toBeVisible();
  await expect(payslip.getByText("TAX-<123>", { exact: true })).toBeVisible();
  await expect(payslip.getByText("SOC-9012", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Allowances", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Deductions", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Net Pay", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Gross Taxable Pay", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Tax Paid", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Tax Reference (ITIS)", { exact: true })).toBeVisible();
  await expect(payslip.getByText("Social Security Number", { exact: true })).toBeVisible();
  await expect(payslip.getByText("£2400.00", { exact: true }).first()).toBeVisible();
  await expect(payslip.getByText("£384.00", { exact: true })).toBeVisible();
  await expect(payslip.getByText("£2016.00", { exact: true })).toBeVisible();
  await expect(payslip.locator("body")).not.toContainText(/draft|manual payroll/i);
  await expect(payslip.locator("body")).not.toContainText(/BACS|account number|sort code/i);
  await expect(payslip.locator("img")).toHaveCount(0);
  await expect(payslip.locator("script")).toHaveCount(0);

  const writes = api.calls.filter((call) => call.method === "POST");
  expect(writes.map((call) => call.path)).toEqual([
    "/api/admin/payroll-runs",
    "/api/admin/payroll-runs/payroll-run-1/review",
    "/api/admin/payroll-runs/payroll-run-1/payslips/worker-1",
  ]);
  expect(writes[0].body).toEqual({});
  expect(writes[1].body).toEqual({ decision: "approved" });
  expect(writes[2].body).toEqual({});
  expect(writes.some((call) => /\/payments?|bank-transfers?|\/transfer/i.test(call.path))).toBe(false);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("admin creates a complete custom payroll from employee and hours on mobile", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installAdminApi(context);

  await page.goto("/clock");
  await expect(page.getByRole("heading", { name: "Create a custom payroll" })).toBeVisible();
  await page.getByRole("combobox", { name: "Employee" }).selectOption("worker-1");
  await page.getByRole("spinbutton", { name: "Hours to pay" }).fill("40");
  await page.getByRole("button", { name: "Create for review" }).click();

  await expect(page.getByRole("status")).toContainText("Custom payroll created from the saved worker and business details.");
  await expect(page.getByText("Awaiting review", { exact: true })).toBeVisible();
  const submitCall = api.calls.find((call) => call.method === "POST" && call.path === "/api/admin/payroll-runs");
  expect(submitCall?.body).toEqual({ custom: { userId: "worker-1", hours: 40 } });

  await page.getByRole("button", { name: "Approve and mark ready" }).click();
  await page.getByRole("button", { name: "Open Salary Advice" }).click();
  await page.getByRole("button", { name: "Prepare Salary Advice" }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / save final Salary Advice" }).click();
  const payslip = await popupPromise;
  await expect(payslip.locator("td").filter({ hasText: "Basic pay · custom hours" }).first()).toContainText("Basic pay · custom hours");
  await expect(payslip.getByText("Administrator-entered hours", { exact: true })).toBeVisible();
  await expect(payslip.getByText("40.00", { exact: true })).toBeVisible();
  await expect(payslip.getByText("£800.00", { exact: true }).first()).toBeVisible();
  await expect(payslip.getByText("£128.00", { exact: true })).toBeVisible();
  await expect(payslip.getByText("£672.00", { exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("approved Salary Advice roster stays contained on a mobile viewport", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installAdminApi(context);

  await page.goto("/clock");
  await page.getByRole("button", { name: "Submit current preview for approval" }).click();
  await page.getByRole("button", { name: "Approve and mark ready" }).click();
  await page.getByRole("button", { name: "Open Salary Advice" }).click();

  await expect(page.getByRole("heading", { name: "Final worker documents" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expectNoExternalRequests(api);
});

test("a worker session cannot render payroll approval controls", async ({ context, page }) => {
  const api = await installWorkerApi(context);

  await page.goto("/");
  await expect(page.getByText("My shift", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review and approve payroll" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve and mark ready" })).toHaveCount(0);
  expectNoExternalRequests(api);
});

test("admin can request payroll changes with the required review note", async ({ context, page }) => {
  const api = await installAdminApi(context);

  await page.goto("/");
  await page.getByRole("button", { name: "Submit current preview for approval" }).click();
  await page.getByRole("button", { name: "Request changes" }).click();

  await expect(page.getByRole("status")).toContainText("Payroll changes requested.");
  await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();
  const reviewCall = api.calls.find((call) => call.path.endsWith("/review"));
  expect(reviewCall?.body).toEqual({
    decision: "changes_requested",
    note: "Review the payroll details and resubmit the corrected period.",
  });
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});
