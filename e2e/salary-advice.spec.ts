import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { expectCsrfOnWrites, expectNoExternalRequests, installAdminApi, installWorkerApi } from "./support/mockApi";

function extractPdfText(document: PDFDocument): string {
  const contentsReference = document.getPage(0).node.Contents();
  if (!contentsReference) return "";
  const contents = document.context.lookup(contentsReference);
  const references = contents instanceof PDFArray ? contents.asArray() : [contentsReference];
  return references.flatMap((reference) => {
    const stream = document.context.lookup(reference);
    if (!(stream instanceof PDFRawStream)) return [];
    const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    return Array.from(decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g), (match) => Buffer.from(match[1], "hex").toString("latin1"));
  }).join("\n");
}

async function expectValidSalaryAdvicePdf(download: Download, filename: string): Promise<string> {
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

  const document = await PDFDocument.load(bytes);
  expect(document.getTitle()).toBe("Salary Advice");
  expect(document.getAuthor()).toBe("Field Hours");
  expect(document.getPageCount()).toBe(1);
  const { width, height } = document.getPage(0).getSize();
  expect(width).toBeGreaterThan(height);
  return extractPdfText(document);
}

async function openAccountMenu(page: Page, displayName: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`${displayName}.*account menu`, "i") }).click();
}

async function openSalaryAdvice(page: Page): Promise<void> {
  await page.goto("/clock");
  await page.getByRole("button", { name: "Salary Advice", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Calculate and download Salary Advice" })).toBeVisible();
}

test("admin selects a Monday-to-Sunday week and downloads a Salary Advice PDF without approval", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installAdminApi(context);

  await openSalaryAdvice(page);
  await expect(page.getByRole("heading", { name: "Review and approve payroll" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Request history" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Google sign-in requests" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Password reset requests" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /approve|request changes|create for review/i })).toHaveCount(0);
  await expect(page.getByText("Standard hourly rate", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Employer Social Security", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Business (Tax|Social) Reference/i)).toHaveCount(0);

  await page.getByRole("combobox", { name: "Employee" }).selectOption("worker-1");
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toHaveAttribute("aria-pressed", "true");
  const week = page.getByRole("combobox", { name: "Week (Monday to Sunday)" });
  const weekValues = await week.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(weekValues).toHaveLength(53);
  expect(weekValues.at(0)).toBe("2026-12-28");
  expect(weekValues.at(-1)).toBe("2025-12-29");
  expect(weekValues.every((value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
  await expect(week.locator('option[value="2026-12-28"]')).toHaveAttribute("disabled", "");
  await expect(week.locator('option[value="2025-12-29"]')).toHaveAttribute("disabled", "");
  expect(await week.locator("option:not([disabled])").count()).toBe(51);
  await week.selectOption("2026-08-24");
  await expect(page.getByLabel("Pay date")).toHaveValue("2026-08-30");
  await expect(page.getByRole("spinbutton", { name: /Rate for this Salary Advice/ })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: /Confirmed ITIS for this document/ })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: /weekly.*Social Security/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Check saved hours" }).click();
  await expect(page.getByText("£800.00", { exact: true }).filter({ visible: true })).toBeVisible();

  const filename = "salary-advice_EMP-001_2026-08-24_2026-08-30.pdf";
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calculate and download PDF" }).click();
  const download = await downloadPromise;
  const pdfText = await expectValidSalaryAdvicePdf(download, filename);
  for (const requiredText of [
    "Salary Advice",
    "Field Hours Test",
    "Period: 2026-08-24 to 2026-08-30",
    "Weekly - Monday to Sunday",
    "ESTIMATE",
    "informational document",
    "Basic Hourly Pay",
    "Income Tax / ITIS 15.00%",
    "Employee Social Security 6.00%",
    "EMP-001",
    "Worker Test",
    "TAX-123",
    "SOC-9012",
    "Gross Taxable Pay",
    "Tax Paid",
    "Net Pay",
    "£800.00",
    "£48.00",
    "£632.00",
    "£800.00",
    "£120.00",
  ]) {
    expect(pdfText).toContain(requiredText);
  }
  expect(pdfText).not.toMatch(/Employer Social Security|Business (Tax|Social) Reference|BACS|bank|approve|review/i);

  await expect(page.getByRole("status")).toContainText(`PDF downloaded: ${filename}`);
  await expect(page.getByRole("heading", { name: "Downloaded document summary" })).toBeVisible();
  await expect(page.getByText("Worker Test · 2026-08-24 – 2026-08-30", { exact: true })).toBeVisible();
  await expect(page.getByText("£800.00", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("£168.00", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("£632.00", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByText("View breakdown", { exact: true }).click();
  await expect(page.getByText("£48.00", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Estimate based on completed shifts/i)).toBeVisible();
  await openAccountMenu(page, "Admin Test");
  await page.locator("#field-hours-account-panel").getByRole("button", { name: "ES", exact: true }).click();

  const writes = api.calls.filter((call) => call.method === "POST");
  expect(writes).toHaveLength(2);
  expect(writes.every((call) => call.path === "/api/admin/salary-advice")).toBe(true);
  expect(writes.every((call) => JSON.stringify(call.body) === JSON.stringify({
    userId: "worker-1",
    periodType: "weekly",
    periodStart: "2026-08-24",
    payDate: "2026-08-30",
  }))).toBe(true);
  expect(api.calls.some((call) => /payroll-(preview|runs)|\/review|payslips|payments?|bank-transfers?/i.test(call.path))).toBe(false);
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("unsaved business identity blocks Salary Advice until the settings write succeeds", async ({ context, page }) => {
  const api = await installAdminApi(context);
  await openSalaryAdvice(page);
  const calculate = page.getByRole("button", { name: "Calculate and download PDF" });
  const businessName = page.getByRole("textbox", { name: "Business name" });

  await expect(calculate).toBeEnabled();
  await businessName.fill("Field Hours Updated");
  await expect(calculate).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(/Save business name or address changes/i);
  expect(api.calls.some((call) => call.path === "/api/admin/salary-advice")).toBe(false);

  await page.getByRole("button", { name: "Save document details" }).click();
  await expect(calculate).toBeEnabled();
  const settingsWrite = api.calls.find((call) => call.method === "POST" && call.path === "/api/admin/payroll-settings");
  expect(settingsWrite?.body).toEqual({
    businessName: "Field Hours Updated",
    businessAddress: "1 Test Street",
    itisRate: 15,
  });
  expectCsrfOnWrites(api.calls);
});

test("only the administrator can update the employee profile hourly rate from Salary Advice", async ({ context, page }) => {
  const api = await installAdminApi(context);
  await openSalaryAdvice(page);
  const profile = page.getByRole("article").filter({ hasText: "Worker Test" });
  const rate = profile.getByRole("spinbutton", { name: /Employee hourly rate/ });
  await rate.fill("21.25");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile.getByRole("status")).toContainText("Employee rate saved");
  const write = api.calls.find((call) => call.method === "POST" && call.path === "/api/admin/payroll-profiles/worker-1/compensation");
  expect(write?.body).toEqual({ hourlyRate: 21.25 });
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("business identity stays locked while saving and a failed save keeps PDF generation blocked", async ({ context, page }) => {
  await installAdminApi(context, { settingsDelayMs: 400, settingsError: true });
  await openSalaryAdvice(page);
  const calculate = page.getByRole("button", { name: "Calculate and download PDF" });
  const businessName = page.getByRole("textbox", { name: "Business name" });
  const save = page.getByRole("button", { name: "Save document details" });

  await businessName.fill("Unsaved Identity");
  await save.click();
  await expect(businessName).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(calculate).toBeDisabled();
  await expect(page.getByRole("alert").filter({ hasText: "Business details could not be saved." })).toBeVisible();
  await expect(businessName).toBeEnabled();
  await expect(calculate).toBeDisabled();
});

test("monthly Salary Advice calculates from the saved profile and annual settings", async ({ context, page }) => {
  const api = await installAdminApi(context);

  await openSalaryAdvice(page);
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Monthly", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Calendar month" }).selectOption("2026-08-01");
  await expect(page.getByLabel("Pay date")).toHaveValue("2026-08-31");
  await expect(page.getByRole("spinbutton", { name: /Rate for this Salary Advice/ })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: /Confirmed ITIS for this document/ })).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: /weekly.*Social Security/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Check saved hours" }).click();
  await expect(page.getByText("£2,400.00", { exact: true }).last()).toBeVisible();

  const filename = "salary-advice_EMP-001_2026-08-01_2026-08-31.pdf";
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calculate and download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();

  const request = api.calls.find((call) => call.method === "POST" && call.path === "/api/admin/salary-advice");
  expect(request?.body).toEqual({
    userId: "worker-1",
    periodType: "monthly",
    periodStart: "2026-08-01",
    payDate: "2026-08-31",
  });
  expectCsrfOnWrites(api.calls);
  expectNoExternalRequests(api);
});

test("automatic calculation checks the selected employee and period", async ({ context, page }) => {
  await installAdminApi(context);
  await openSalaryAdvice(page);
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await page.getByRole("button", { name: "Check saved hours" }).click();
  await expect(page.getByText("£2,400.00", { exact: true }).last()).toBeVisible();
  await page.getByRole("combobox", { name: "Employee" }).selectOption("worker-2");
  await page.getByRole("combobox", { name: "Calendar month" }).selectOption("2026-07-01");
  await page.getByRole("button", { name: "Check saved hours" }).click();
  await expect(page.getByText("£1,800.00", { exact: true }).last()).toBeVisible();
});

test("employee and period controls are locked while a Salary Advice response is pending", async ({ context, page }) => {
  await installAdminApi(context, { salaryAdviceDelayMs: 500 });
  await openSalaryAdvice(page);
  await page.getByRole("combobox", { name: "Week (Monday to Sunday)" }).selectOption("2026-08-24");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calculate and download PDF" }).click();
  await expect(page.getByRole("combobox", { name: "Employee" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Week (Monday to Sunday)" })).toBeDisabled();
  await downloadPromise;
  await expect(page.getByRole("combobox", { name: "Employee" })).toBeEnabled();
});

test("employee identity dialog includes the PDF address and restores keyboard focus", async ({ context, page }) => {
  await installAdminApi(context);
  await openSalaryAdvice(page);
  const profile = page.getByRole("article").filter({ hasText: "Worker Test" });
  const reveal = profile.getByRole("button", { name: "View details" });
  await reveal.click();
  const dialog = page.getByRole("dialog", { name: "Employee details" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1 Worker Road", { exact: true })).toBeVisible();
  await expect(dialog.getByText("TAX-123", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(reveal).toBeFocused();
});

test("admin account panel invokes the available Android PWA install prompt", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installAdminApi(context);
  await page.goto("/");
  await page.evaluate(() => {
    const target = window as typeof window & { __installPromptCalls?: number };
    target.__installPromptCalls = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          target.__installPromptCalls = (target.__installPromptCalls ?? 0) + 1;
        },
      },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });
    window.dispatchEvent(event);
  });

  await openAccountMenu(page, "Admin Test");
  const install = page.getByRole("button", { name: "Install app on Android" });
  await expect(install).toBeVisible();
  await install.click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __installPromptCalls?: number }).__installPromptCalls)).toBe(1);
  await expect(page.getByRole("button", { name: "Install app on Android" })).toHaveCount(0);
  expectNoExternalRequests(api);
});

test("account menu closes with Escape or outside click and restores trigger focus", async ({ context, page }) => {
  await installAdminApi(context);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Admin Test.*account menu/i });

  await trigger.click();
  await expect(page.getByRole("button", { name: "Install app on Android" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: "Set up Google sign-in" })).toHaveCount(0);

  await trigger.click();
  await page.locator("main").click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole("button", { name: "Set up Google sign-in" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("worker account panel exposes Android install guidance and the current-month summary", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installWorkerApi(context, { adminCreatedHistory: true });
  await page.goto("/");

  await page.getByRole("button", { name: "Hours overview", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Hours overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calculate and download Salary Advice" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Calculate and download PDF" })).toHaveCount(0);
  await expect(page.getByText("This month", { exact: true })).toBeVisible();
  await expect(page.getByText("All completed shifts", { exact: true })).toBeVisible();
  await openAccountMenu(page, "Worker Test");
  const install = page.getByRole("button", { name: "Install app on Android" });
  await expect(install).toBeVisible();
  await install.click();
  await expect(page.getByRole("status")).toContainText(/On Android, open Chrome.*menu/i);
  expectNoExternalRequests(api);
});

test("Android install action handles dismissal, prompt failure and appinstalled without an unhandled rejection", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context);
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => {} },
      userChoice: { value: Promise.resolve({ outcome: "dismissed", platform: "web" }) },
    });
    window.dispatchEvent(event);
  });
  await openAccountMenu(page, "Admin Test");
  await page.getByRole("button", { name: "Install app on Android" }).click();
  await expect(page.getByRole("status")).toContainText(/Installation was not completed/i);

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => { throw new Error("synthetic prompt failure"); } },
      userChoice: { value: Promise.resolve({ outcome: "dismissed", platform: "web" }) },
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install app on Android" }).click();
  await expect(page.getByRole("status")).toContainText(/Chrome could not open the installer/i);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByRole("button", { name: "Install app on Android" })).toHaveCount(0);
});
