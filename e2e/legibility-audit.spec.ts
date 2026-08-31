import { expect, test, type Page } from "@playwright/test";
import { expectKeyboardFocusVisible, expectLegiblePage } from "./support/legibility";
import { installAdminApi, installWorkerApi } from "./support/mockApi";

const mobileViewports = [
  { name: "mobile-320x568", width: 320, height: 568 },
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-430x932", width: 430, height: 932 },
] as const;

function visibleButton(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true });
}

async function chooseSection(page: Page, name: string): Promise<void> {
  await visibleButton(page, name).click();
  await expect(visibleButton(page, name)).toHaveAttribute("aria-current", "page");
}

for (const viewport of mobileViewports) {
  test(`dense admin interface remains legible on ${viewport.name}`, async ({ context, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await installAdminApi(context, { denseData: true });
    await page.goto("/clock?section=today");
    await expect(page.getByText("Worker Test", { exact: true }).filter({ visible: true }).first()).toBeVisible();

    await expectLegiblePage(page, testInfo, `admin-live-${viewport.name}`);
    await expectKeyboardFocusVisible(page, testInfo, `admin-live-${viewport.name}`);

    await chooseSection(page, "History & Reports");
    await expect(page).toHaveURL(/section=history/);
    await expect(page.getByRole("heading", { name: "Shift History & Reports" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-history-${viewport.name}`);

    await chooseSection(page, "Salary Advice");
    await expect(page.getByRole("heading", { name: "Calculate and download Salary Advice" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-salary-create-${viewport.name}`);
    await visibleButton(page, "Business").click();
    await expect(page.getByRole("heading", { name: "Business details for the document" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-salary-business-${viewport.name}`);
    await visibleButton(page, "Employees").click();
    await expect(page.getByRole("heading", { name: "Employee details" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-salary-employees-${viewport.name}`);

    await chooseSection(page, "Projects & Sites");
    await expect(page.getByRole("heading", { name: "Manage Construction Projects" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-projects-${viewport.name}`);

    await chooseSection(page, "More");
    await expect(page.getByRole("heading", { name: "Team & access" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-access-${viewport.name}`);
  });

  test(`dense worker interface remains legible on ${viewport.name}`, async ({ context, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await installWorkerApi(context, { denseData: true });
    await page.goto("/clock?section=today");
    await expect(page.getByText("My shift", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeInViewport({ ratio: 1 });

    await expectLegiblePage(page, testInfo, `worker-main-${viewport.name}`);
    await expectKeyboardFocusVisible(page, testInfo, `worker-main-${viewport.name}`);

    await chooseSection(page, "History & Reports");
    await expect(page.getByRole("heading", { name: "My Past Shifts" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `worker-history-${viewport.name}`);

    await chooseSection(page, "Hours overview");
    await expect(page.getByRole("heading", { name: "Hours overview" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `worker-pay-${viewport.name}`);
  });
}

test("mobile dialogs remain legible at 390x844", async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context);
  await page.goto("/clock?section=history");

  const addWorkday = page.getByRole("button", { name: "Add workday", exact: true });
  await addWorkday.focus();
  await page.keyboard.press("Enter");
  const workdayDialog = page.getByRole("dialog", { name: "Create workday hours" });
  await expect(workdayDialog).toBeVisible();
  await expectLegiblePage(page, testInfo, "admin-workday-dialog-mobile-390x844");
  await page.keyboard.press("Escape");
  await expect(workdayDialog).toHaveCount(0);
  await expect(addWorkday).toBeFocused();

  await chooseSection(page, "Projects & Sites");
  const addProject = page.getByRole("button", { name: "Add Project", exact: true });
  await addProject.focus();
  await page.keyboard.press("Enter");
  const projectDialog = page.getByRole("dialog", { name: "New Project" });
  await expect(projectDialog).toBeVisible();
  await expectLegiblePage(page, testInfo, "admin-project-dialog-mobile-390x844");
  await page.keyboard.press("Escape");
  await expect(projectDialog).toHaveCount(0);
  await expect(addProject).toBeFocused();
});

test("admin Salary Advice error state remains legible", async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context, { salaryAdviceError: true });
  await page.goto("/clock?section=salary");
  await expect(page.getByRole("heading", { name: "Calculate and download Salary Advice" })).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await page.getByRole("combobox", { name: "Calendar month" }).selectOption("2026-08-01");
  await page.getByRole("spinbutton", { name: "Rate for this Salary Advice (£)" }).fill("5");
  await page.getByRole("spinbutton", { name: "Confirmed ITIS for this document (%)" }).fill("15");
  await page.getByRole("button", { name: /Standard.*6%/i }).click();
  await page.getByRole("spinbutton", { name: "Gross taxable pay to date (£)" }).fill("17928.50");
  await page.getByRole("spinbutton", { name: "ITIS paid to date (£)" }).fill("2554.08");
  await page.getByRole("button", { name: "Calculate and download PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("Salary Advice could not be calculated for the selected period.");
  await expectLegiblePage(page, testInfo, "admin-salary-advice-error-mobile-390x844");
});
