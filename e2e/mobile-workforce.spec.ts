import { expect, test, type Locator, type Page } from "@playwright/test";
import { installAdminApi, installWorkerApi, type MockLanguage } from "./support/mockApi";

const localeCopy: Record<MockLanguage, {
  adminProjects: string;
  adminProjectsHeading: string;
  adminSalaryHeading: string;
  history: string;
  more: string;
  pay: string;
  teamAccessHeading: string;
  workerHistoryHeading: string;
}> = {
  en: {
    adminProjects: "Projects & Sites",
    adminProjectsHeading: "Manage Construction Projects",
    adminSalaryHeading: "Calculate and download Salary Advice",
    history: "History & Reports",
    more: "More",
    pay: "Hours overview",
    teamAccessHeading: "Team & access",
    workerHistoryHeading: "My Past Shifts",
  },
  es: {
    adminProjects: "Proyectos y Obras",
    adminProjectsHeading: "Gestión de Proyectos y Obras",
    adminSalaryHeading: "Calcular y descargar Salary Advice",
    history: "Historial y Reportes",
    more: "Más",
    pay: "Resumen de horas",
    teamAccessHeading: "Equipo y accesos",
    workerHistoryHeading: "Mis Turnos Anteriores",
  },
  pt: {
    adminProjects: "Projetos e Obras",
    adminProjectsHeading: "Gestão de Obras e Projetos",
    adminSalaryHeading: "Calcular e baixar Salary Advice",
    history: "Histórico e Relatórios",
    more: "Mais",
    pay: "Resumo de horas",
    teamAccessHeading: "Equipe e acessos",
    workerHistoryHeading: "Meus Turnos Anteriores",
  },
};

function visibleButton(page: Page, name: string | RegExp): Locator {
  return page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true });
}

async function expectNoHorizontalClipping(page: Page): Promise<void> {
  const audit = await page.evaluate(() => {
    const clippedControls = [...document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return false;
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((element) => ({
        name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName,
        rect: element.getBoundingClientRect().toJSON(),
      }));
    return {
      clippedControls,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(audit.documentWidth, JSON.stringify(audit)).toBeLessThanOrEqual(audit.viewportWidth + 1);
  expect(audit.clippedControls, JSON.stringify(audit)).toEqual([]);
}

async function expectMinimumTarget(locator: Locator, minimum = 44): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, "touch target must have a rendered box").not.toBeNull();
  expect(box!.width, "touch target width").toBeGreaterThanOrEqual(minimum);
  expect(box!.height, "touch target height").toBeGreaterThanOrEqual(minimum);
}

test.describe("mobile task hierarchy", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("worker clock action stays in the first viewport with 44px task targets", async ({ context, page }) => {
    await installWorkerApi(context, { denseData: true });
    await page.goto("/clock?section=today");

    const clockIn = page.getByRole("button", { name: "Clock in", exact: true });
    await expect(clockIn).toBeVisible();
    await expect(clockIn).toBeInViewport({ ratio: 1 });
    await expectMinimumTarget(clockIn);
    await expectMinimumTarget(page.getByRole("button", { name: /Worker Test.*account menu/i }));
    for (const name of ["Live Today", "History & Reports", "Hours overview"]) {
      await expectMinimumTarget(visibleButton(page, name));
    }
    await expectNoHorizontalClipping(page);
  });

  test("admin metrics and first worker stay in the first viewport", async ({ context, page }) => {
    await installAdminApi(context, { denseData: true });
    await page.goto("/clock?section=today");

    for (const metric of ["Working", "On break", "Finished", "Team"]) {
      await expect(page.getByText(metric, { exact: true }).first()).toBeVisible();
    }
    const firstWorker = page.getByText("Worker Test", { exact: true }).filter({ visible: true }).first();
    await expect(firstWorker).toBeVisible();
    await expect(firstWorker).toBeInViewport({ ratio: 1 });
    for (const name of ["Live Today", "History & Reports", "Salary Advice", "Projects & Sites", "More"]) {
      await expectMinimumTarget(visibleButton(page, name));
    }
    await expectNoHorizontalClipping(page);
  });
});

test("worker clock action stays fully above the bottom navigation at 320x568", async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installWorkerApi(context, { denseData: true });
  await page.goto("/clock?section=today");

  const clockIn = page.getByRole("button", { name: "Clock in", exact: true });
  const projectSelector = page.getByRole("combobox", { name: "Assigned Project / Job Site" });
  const bottomNavigation = page.getByRole("navigation", { name: "Sections" }).filter({ visible: true });
  await expect(clockIn).toBeInViewport({ ratio: 1 });
  await expectMinimumTarget(clockIn);
  const [clockBox, projectBox, navigationBox] = await Promise.all([clockIn.boundingBox(), projectSelector.boundingBox(), bottomNavigation.boundingBox()]);
  expect(clockBox).not.toBeNull();
  expect(projectBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(projectBox!.y + projectBox!.height).toBeLessThanOrEqual(clockBox!.y - 4);
  expect(clockBox!.y + clockBox!.height).toBeLessThanOrEqual(navigationBox!.y + 1);
  await expectNoHorizontalClipping(page);
});

test("worker section URL supports back, forward and reload", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorkerApi(context, { denseData: true });
  await page.goto("/clock?section=today");

  await visibleButton(page, "History & Reports").click();
  await expect(page).toHaveURL(/section=history/);
  await expect(page.getByRole("heading", { name: "My Past Shifts" })).toBeVisible();
  await expect(page.getByTestId("worker-history-record")).toHaveCount(8);
  await page.getByRole("button", { name: /^Show more/ }).click();
  await expect(page.getByTestId("worker-history-record")).toHaveCount(16);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await visibleButton(page, "Hours overview").click();
  await expect(page).toHaveURL(/section=pay/);
  await expect(page.getByRole("heading", { name: "Hours overview" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  await page.goBack();
  await expect(page).toHaveURL(/section=history/);
  await expect(page.getByRole("heading", { name: "My Past Shifts" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page).toHaveURL(/section=history/);
  await expect(page.getByRole("heading", { name: "My Past Shifts" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/section=pay/);
  await expect(page.getByRole("heading", { name: "Hours overview" })).toBeVisible();
});

test("worker saves the ITIS percentage with the payroll profile", async ({ context, page }) => {
  await installWorkerApi(context);
  await page.goto("/clock?section=pay");

  await page.getByRole("textbox", { name: "Legal name" }).fill("Worker Test");
  await page.getByRole("textbox", { name: "Employee number" }).fill("EMP-001");
  await page.getByRole("textbox", { name: "Home address" }).fill("1 Worker Road");
  await page.getByRole("textbox", { name: /Tax Reference \(ITIS\)/ }).fill("TAX-123");
  await page.getByRole("textbox", { name: "Social Security Number" }).fill("SOC-9012");
  await page.getByRole("spinbutton", { name: "Employee ITIS (%)" }).fill("7");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();

  await expect(page.getByText("Details saved and available", { exact: true }).first()).toBeVisible();
});

test("admin section URL supports back, forward and reload", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context, { denseData: true });
  await page.goto("/clock?section=salary");
  await expect(page.getByRole("heading", { name: "Calculate and download Salary Advice" })).toBeVisible();

  await visibleButton(page, "Projects & Sites").click();
  await expect(page).toHaveURL(/section=projects/);
  await expect(page.getByRole("heading", { name: "Manage Construction Projects" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await visibleButton(page, "More").click();
  await expect(page).toHaveURL(/section=access/);
  await expect(page.getByRole("heading", { name: "Team & access" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  await page.goBack();
  await expect(page).toHaveURL(/section=projects/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Manage Construction Projects" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/section=access/);
  await expect(page.getByRole("heading", { name: "Team & access" })).toBeVisible();
});

test("dense mobile records and actions do not require horizontal scrolling", async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installAdminApi(context, { denseData: true });

  const sections = [
    { id: "history", heading: "Shift History & Reports" },
    { id: "projects", heading: "Manage Construction Projects" },
    { id: "access", heading: "Team & access" },
  ] as const;
  for (const section of sections) {
    await page.goto(`/clock?section=${section.id}`);
    await expect(page.getByRole("heading", { name: section.heading })).toBeVisible();
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalClipping(page);
  }
});

test("secondary access panels stay compact and can be expanded on mobile", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context, { denseData: true });
  await page.goto("/clock?section=access");

  const inviteDisclosure = page.locator("summary").filter({ hasText: "Scan to join" });
  const auditDisclosure = page.locator("summary").filter({ hasText: "Request history" });
  const createInvitation = page.getByRole("button", { name: "Create invitation", exact: true });
  const firstAuditRecord = page.locator("article").getByText("Reviewed Account 1", { exact: true });

  await expect(inviteDisclosure).toBeVisible();
  await expect(auditDisclosure).toBeVisible();
  await expect(createInvitation).not.toBeVisible();
  await expect(firstAuditRecord).not.toBeVisible();

  await inviteDisclosure.click();
  await expect(createInvitation).toBeVisible();
  await auditDisclosure.click();
  await expect(firstAuditRecord).toBeVisible();
  await expectNoHorizontalClipping(page);
});

test("dense mobile lists reveal records progressively", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(context, { denseData: true });

  await page.goto("/clock?section=today");
  await expect(page.getByTestId("admin-team-member")).toHaveCount(8);
  await page.getByRole("button", { name: /^Show more/ }).click();
  await expect(page.getByTestId("admin-team-member")).toHaveCount(14);

  await page.goto("/clock?section=history");
  await expect(page.getByTestId("admin-history-record")).toHaveCount(8);
  await page.getByRole("button", { name: /^Show more/ }).click();
  await expect(page.getByTestId("admin-history-record")).toHaveCount(16);

  await page.goto("/clock?section=projects");
  await expect(page.getByTestId("admin-project-record")).toHaveCount(8);
  await page.getByRole("button", { name: /^Show more/ }).click();
  await expect(page.getByTestId("admin-project-record")).toHaveCount(12);
  await expectNoHorizontalClipping(page);
});

test("custom mobile dialogs close with Escape and return focus", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorkerApi(context);
  await page.goto("/clock?section=today");

  const addProject = page.getByRole("button", { name: "Add Project", exact: true });
  await addProject.click();
  const dialog = page.getByRole("dialog", { name: "New Project" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(addProject).toBeFocused();
});

for (const language of ["es", "en", "pt"] as const) {
  const copy = localeCopy[language];

  test(`worker key routes remain localized in ${language.toUpperCase()}`, async ({ context, page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await installWorkerApi(context, { denseData: true, language });
    await page.goto("/clock?section=pay");

    await expect(visibleButton(page, copy.pay)).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: copy.pay })).toBeVisible();
    await visibleButton(page, copy.history).click();
    await expect(page).toHaveURL(/section=history/);
    await expect(page.getByRole("heading", { name: copy.workerHistoryHeading })).toBeVisible();
    await expectNoHorizontalClipping(page);
  });

  test(`admin key routes remain localized in ${language.toUpperCase()}`, async ({ context, page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await installAdminApi(context, { denseData: true, language });
    await page.goto("/clock?section=salary");

    await expect(page.getByRole("heading", { name: copy.adminSalaryHeading })).toBeVisible();
    await visibleButton(page, copy.adminProjects).click();
    await expect(page).toHaveURL(/section=projects/);
    await expect(page.getByRole("heading", { name: copy.adminProjectsHeading })).toBeVisible();
    await visibleButton(page, copy.more).click();
    await expect(page).toHaveURL(/section=access/);
    await expect(page.getByRole("heading", { name: copy.teamAccessHeading })).toBeVisible();
    await expectNoHorizontalClipping(page);
  });
}
