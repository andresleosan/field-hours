import { expect, test } from "@playwright/test";
import { expectCsrfOnWrites, expectNoExternalRequests, installAdminApi } from "./support/mockApi";

test.use({ viewport: { width: 390, height: 844 } });

test("admin creates a complete workday with a required employee-visible description", async ({ context, page }) => {
  const api = await installAdminApi(context);

  await page.goto("/");
  await page.getByRole("button", { name: "History & Reports", exact: true }).click();

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
  await expect(page.getByText("Worker Test", { exact: true }).last()).toBeVisible();

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
