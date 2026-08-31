import { expect, type Page, type TestInfo } from "@playwright/test";

interface LegibilityViolation {
  background: string;
  color: string;
  contrast: number;
  selector: string;
  text: string;
  threshold: number;
  type: "placeholder" | "text";
}

interface LegibilityAudit {
  accessibilityIssues: string[];
  horizontalOverflow: boolean;
  violations: LegibilityViolation[];
}

export async function auditLegibility(page: Page): Promise<LegibilityAudit> {
  return page.evaluate(() => {
    interface Rgba {
      a: number;
      b: number;
      g: number;
      r: number;
    }

    interface BrowserViolation {
      background: string;
      color: string;
      contrast: number;
      selector: string;
      text: string;
      threshold: number;
      type: "placeholder" | "text";
    }

    const parseColor = (value: string): Rgba | null => {
      const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      if (!match) return null;
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      };
    };

    const composite = (foreground: Rgba, background: Rgba): Rgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { r: 255, g: 255, b: 255, a: 1 };
      return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
      };
    };

    const luminance = (color: Rgba): number => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };

    const ratio = (first: Rgba, second: Rgba): number => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    const cssColor = (color: Rgba): string => `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a.toFixed(2)})`;

    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((sibling) => sibling.tagName === current?.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    };

    const isVisible = (element: HTMLElement): boolean => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return false;
      if (element.closest("[hidden], [aria-hidden='true'], :disabled, [aria-disabled='true']")) return false;
      let opacity = 1;
      let current: HTMLElement | null = element;
      while (current) {
        opacity *= Number(getComputedStyle(current).opacity || 1);
        current = current.parentElement;
      }
      return opacity >= 0.05;
    };

    const effectiveBackground = (element: HTMLElement): Rgba => {
      const ancestors: HTMLElement[] = [];
      let current: HTMLElement | null = element;
      while (current) {
        ancestors.push(current);
        current = current.parentElement;
      }
      let background: Rgba = { r: 255, g: 255, b: 255, a: 1 };
      for (const ancestor of ancestors.reverse()) {
        const parsed = parseColor(getComputedStyle(ancestor).backgroundColor);
        if (parsed && parsed.a > 0) background = composite(parsed, background);
      }
      return background;
    };

    const directText = (element: HTMLElement): string => [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean)
      .join(" ");

    const violations: BrowserViolation[] = [];
    const accessibilityIssues: string[] = [];

    const inspect = (element: HTMLElement, text: string, colorValue: string, type: "placeholder" | "text") => {
      if (!text || !isVisible(element)) return;
      const style = getComputedStyle(element);
      const color = parseColor(colorValue);
      if (!color) return;
      const background = effectiveBackground(element);
      const renderedColor = composite(color, background);
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const threshold = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
      const contrast = ratio(renderedColor, background);
      if (contrast + 0.01 >= threshold) return;
      violations.push({
        background: cssColor(background),
        color: cssColor(renderedColor),
        contrast: Number(contrast.toFixed(2)),
        selector: selectorFor(element),
        text: text.slice(0, 140),
        threshold,
        type,
      });
    };

    for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
      const tag = element.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "svg" || tag === "path") continue;
      inspect(element, directText(element), getComputedStyle(element).color, "text");
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.placeholder && !element.value) {
          inspect(element, element.placeholder, getComputedStyle(element, "::placeholder").color, "placeholder");
        }
      }
    }

    const referencedText = (element: Element, attribute: string): string => (element.getAttribute(attribute) ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");

    const accessibleName = (element: HTMLElement): string => {
      const explicit = element.getAttribute("aria-label")?.trim()
        || referencedText(element, "aria-labelledby")
        || element.getAttribute("title")?.trim();
      if (explicit) return explicit;
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        return [...(element.labels ?? [])].map((label) => label.textContent?.trim() ?? "").filter(Boolean).join(" ");
      }
      return element.innerText.trim();
    };

    for (const element of document.body.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")) {
      if (!isVisible(element) || (element instanceof HTMLInputElement && element.type === "hidden")) continue;
      if (!accessibleName(element)) accessibilityIssues.push(`${selectorFor(element)} has no accessible name`);
    }

    for (const dialog of document.body.querySelectorAll<HTMLElement>("[role='dialog']")) {
      const dialogName = dialog.getAttribute("aria-label")?.trim() || referencedText(dialog, "aria-labelledby");
      if (isVisible(dialog) && !dialogName) accessibilityIssues.push(`${selectorFor(dialog)} has no accessible dialog name`);
    }

    return {
      accessibilityIssues,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      violations,
    };
  });
}

export async function expectKeyboardFocusVisible(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      tag: element.tagName.toLowerCase(),
      text: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || "",
    };
  });
  await testInfo.attach(`${label}-focus.json`, {
    body: Buffer.from(JSON.stringify(focus, null, 2)),
    contentType: "application/json",
  });
  expect(focus, `${label} must move keyboard focus to an interactive control`).not.toBeNull();
  const hasIndicator = focus !== null && (
    (focus.outlineStyle !== "none" && Number.parseFloat(focus.outlineWidth) >= 2)
    || focus.boxShadow !== "none"
  );
  expect(hasIndicator, `${label} keyboard focus must have a visible indicator`).toBe(true);
}

export async function expectLegiblePage(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  await page.evaluate(async () => {
    if (!document.getElementById("e2e-legibility-motion-reset")) {
      const style = document.createElement("style");
      style.id = "e2e-legibility-motion-reset";
      style.textContent = "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
      document.head.append(style);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const audit = await auditLegibility(page);
  await testInfo.attach(`${label}-legibility.json`, {
    body: Buffer.from(JSON.stringify(audit, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach(`${label}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(audit.horizontalOverflow, `${label} has page-level horizontal overflow`).toBe(false);
  expect(audit.accessibilityIssues, `${label} has unnamed controls or dialogs`).toEqual([]);
  expect(audit.violations, `${label} has text below WCAG AA contrast`).toEqual([]);
}
