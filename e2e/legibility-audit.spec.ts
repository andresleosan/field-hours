import { expect, test } from "@playwright/test";
import { expectKeyboardFocusVisible, expectLegiblePage } from "./support/legibility";
import { installAdminApi, installWorkerApi } from "./support/mockApi";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`admin interface remains legible on ${viewport.name}`, async ({ context, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await installAdminApi(context);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "History & Reports", exact: true })).toBeVisible();

    await expectLegiblePage(page, testInfo, `admin-live-${viewport.name}`);
    await expectKeyboardFocusVisible(page, testInfo, `admin-live-${viewport.name}`);

    await page.getByRole("button", { name: "History & Reports", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Automatic payroll preview" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-history-${viewport.name}`);

    await page.getByRole("button", { name: "Add workday", exact: true }).click();
    const workdayDialog = page.getByRole("dialog", { name: "Create workday hours" });
    await expect(workdayDialog).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-workday-dialog-${viewport.name}`);
    await workdayDialog.getByRole("combobox", { name: "Worker *" }).selectOption("worker-1");
    await workdayDialog.getByRole("textbox", { name: "Workday description *" }).fill("Legibility audit workday");
    await workdayDialog.getByRole("button", { name: "Save Workday" }).click();
    await expect(page.getByRole("status")).toContainText("Workday created successfully");

    await page.getByRole("button", { name: "Adjust", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Adjust shift times" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-adjust-dialog-${viewport.name}`);
    await page.getByRole("dialog", { name: "Adjust shift times" }).getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Projects & Sites", exact: true }).click();
    await expectLegiblePage(page, testInfo, `admin-projects-${viewport.name}`);
    await page.getByRole("button", { name: "Add Project", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "New Project" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `admin-project-dialog-${viewport.name}`);
    await page.getByRole("dialog", { name: "New Project" }).getByRole("button", { name: "Close" }).click();
  });

  test(`worker interface remains legible on ${viewport.name}`, async ({ context, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await installWorkerApi(context, { adminCreatedHistory: true });
    await page.goto("/");
    await expect(page.getByText("My shift", { exact: true }).first()).toBeVisible();

    await expectLegiblePage(page, testInfo, `worker-main-${viewport.name}`);
    await expectKeyboardFocusVisible(page, testInfo, `worker-main-${viewport.name}`);

    await page.getByRole("button", { name: "Add Project" }).click();
    await expect(page.getByRole("dialog", { name: "New Project" })).toBeVisible();
    await expectLegiblePage(page, testInfo, `worker-project-dialog-${viewport.name}`);
    await page.getByRole("dialog", { name: "New Project" }).getByRole("button", { name: "Close" }).click();
  });
}

test("admin payroll error state remains legible", async ({ context, page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installAdminApi(context, { payrollPreviewError: true });
  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Configure payroll settings");
  await expectLegiblePage(page, testInfo, "admin-payroll-error-desktop");
});
