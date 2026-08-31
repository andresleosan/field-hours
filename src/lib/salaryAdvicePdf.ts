import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import type { SalaryAdvice, SalaryAdviceWarningCode } from "./timeClock";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const COMPLEX_SHAPING_OR_RTL = /[\u0590-\u0FFF\u1000-\u109F\u1780-\u17FF\uFB1D-\uFEFF]/u;
const PRIMARY_FONT_URL = new URL(
  "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-ext-standard-normal.woff2",
  import.meta.url,
);
const UNICODE_FALLBACK_FONT_URL = new URL(
  "../../node_modules/@fontsource/unifont/files/unifont-latin-400-normal.woff",
  import.meta.url,
);

export interface SalaryAdvicePdfFontBytes {
  primary: Uint8Array;
  unicodeFallback: Uint8Array;
}

export class SalaryAdvicePdfError extends Error {
  readonly code: "FONT_LOAD_FAILED" | "UNSUPPORTED_GLYPH" | "UNSUPPORTED_TEXT_LAYOUT";

  constructor(
    code: "FONT_LOAD_FAILED" | "UNSUPPORTED_GLYPH" | "UNSUPPORTED_TEXT_LAYOUT",
    message: string,
  ) {
    super(message);
    this.name = "SalaryAdvicePdfError";
    this.code = code;
  }
}

const WARNING_TEXT: Record<SalaryAdviceWarningCode, string> = {
  WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED:
    "Weekly Social Security was entered by the administrator from the employee's running calendar-month record and must match the official contribution notice.",
};

async function fetchFont(url: URL): Promise<Uint8Array> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new SalaryAdvicePdfError("FONT_LOAD_FAILED", "The embedded Salary Advice font could not be loaded.");
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof SalaryAdvicePdfError) throw error;
    throw new SalaryAdvicePdfError("FONT_LOAD_FAILED", "The embedded Salary Advice font could not be loaded.");
  }
}

async function loadPdfFonts(): Promise<SalaryAdvicePdfFontBytes> {
  const [primary, unicodeFallback] = await Promise.all([
    fetchFont(PRIMARY_FONT_URL),
    fetchFont(UNICODE_FALLBACK_FONT_URL),
  ]);
  return { primary, unicodeFallback };
}

function filenameToken(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return safe || "employee";
}

function wrapPdfText(value: string, maxWidth: number, size: number, font: PDFFont): string[] {
  const output: string[] = [];
  const pushLongWord = (word: string): string => {
    let current = "";
    for (const character of Array.from(word)) {
      const candidate = `${current}${character}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) output.push(current);
        current = character;
      }
    }
    return current;
  };

  for (const paragraph of value.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) output.push(current);
        current = font.widthOfTextAtSize(word, size) <= maxWidth ? word : pushLongWord(word);
      }
    }
    if (current) output.push(current);
    if (words.length === 0) output.push("");
  }
  return output.length > 0 ? output : [""];
}

export function salaryAdviceFilename(advice: SalaryAdvice): string {
  return `salary-advice_${filenameToken(advice.worker.employeeNumber)}_${advice.period.start}_${advice.period.end}.pdf`;
}

export async function createSalaryAdvicePdf(
  advice: SalaryAdvice,
  suppliedFonts?: SalaryAdvicePdfFontBytes,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create();
  document.setTitle("Salary Advice");
  document.setAuthor("Field Hours");
  document.setCreator("Field Hours");
  document.setProducer("Field Hours");
  document.setCreationDate(new Date(advice.calculatedAt));

  const warningTexts = advice.warnings.map((warning) => WARNING_TEXT[warning]);
  const dynamicFields: Array<[string, string]> = [
    ["employer name", advice.employer.name],
    ["employer address", advice.employer.address],
    ["allowance description", advice.allowance.description],
    ["employee number", advice.worker.employeeNumber],
    ["employee legal name", advice.worker.legalName],
    ["employee address", advice.worker.address],
    ["employee tax reference", advice.worker.taxReference],
    ["employee social reference", advice.worker.socialReference],
    ...warningTexts.map((warning, index) => [`warning ${index + 1}`, warning] as [string, string]),
  ];
  const complexField = dynamicFields.find(([, value]) => COMPLEX_SHAPING_OR_RTL.test(value));
  if (complexField) {
    throw new SalaryAdvicePdfError(
      "UNSUPPORTED_TEXT_LAYOUT",
      `The Salary Advice PDF cannot safely lay out every character in ${complexField[0]}. No document was generated; contact support before changing any legal identity data.`,
    );
  }
  let regular: PDFFont = await document.embedFont(StandardFonts.Helvetica);
  const standardSupportsAll = dynamicFields.every(([, value]) => {
    try {
      regular.encodeText(value);
      return true;
    } catch {
      return false;
    }
  });
  if (!standardSupportsAll) {
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    const fonts = suppliedFonts ?? await loadPdfFonts();
    document.registerFontkit(fontkit);
    const primaryFont = fontkit.create(fonts.primary);
    const fallbackFont = fontkit.create(fonts.unicodeFallback);
    const allValues = dynamicFields.map(([, value]) => value).join(" ");
    const allCodePoints = Array.from(allValues, (character) => character.codePointAt(0) ?? 0);
    const useFallback = allCodePoints.some((codePoint) => !primaryFont.hasGlyphForCodePoint(codePoint));
    const selectedFont = useFallback ? fallbackFont : primaryFont;
    for (const [label, value] of dynamicFields) {
      const missing = Array.from(value).find((character) => !selectedFont.hasGlyphForCodePoint(character.codePointAt(0) ?? 0));
      if (missing) {
        throw new SalaryAdvicePdfError(
          "UNSUPPORTED_GLYPH",
          `The Salary Advice PDF cannot represent every character in ${label}. No document was generated; contact support before changing any legal identity data.`,
        );
      }
    }
    regular = await document.embedFont(useFallback ? fonts.unicodeFallback : fonts.primary, { subset: true });
  }
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.11, 0.10);
  const muted = rgb(0.38, 0.37, 0.34);
  const paper = rgb(0.99, 0.985, 0.965);
  const soft = rgb(0.95, 0.93, 0.88);
  const accent = rgb(0.60, 0.35, 0.07);
  const margin = 38;

  const money = (value: number) => `£${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(value)}`;
  const hours = Number.isInteger(advice.allowance.hours * 100)
    ? advice.allowance.hours.toFixed(2)
    : advice.allowance.hours.toFixed(4);

  const drawPageBackground = (page: PDFPage) => {
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
  };
  const drawText = (
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    size = 9,
    font = regular,
    color: RGB = ink,
  ) => page.drawText(value, { x, y, size, font, color });
  const drawRightText = (page: PDFPage, value: string, right: number, y: number, size = 9, font = regular) => {
    drawText(page, value, right - font.widthOfTextAtSize(value, size), y, size, font);
  };
  const drawLine = (page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 0.8) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: ink });
  };
  const drawWrapped = (
    page: PDFPage,
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    size = 8,
    font = regular,
    color: RGB = muted,
  ): string[] => {
    const lines = wrapPdfText(value, maxWidth, size, font);
    lines.forEach((entry, index) => drawText(page, entry, x, y - index * (size + 3), size, font, color));
    return lines;
  };

  const [width, height] = A4_LANDSCAPE;
  const tableWidth = width - margin * 2;
  const leftWidth = tableWidth * 0.54;
  const rightX = margin + leftWidth;
  const employerNameFits = regular.widthOfTextAtSize(advice.employer.name, 10) <= 250;
  const employerAddressLines = wrapPdfText(advice.employer.address, 250, 8, regular);
  const workerAddressLines = wrapPdfText(advice.worker.address, leftWidth - 112, 8, regular);
  const compactIdentityFits = employerNameFits
    && employerAddressLines.length <= 2
    && regular.widthOfTextAtSize(advice.worker.employeeNumber, 9) <= 150
    && regular.widthOfTextAtSize(advice.worker.legalName, 9) <= leftWidth - 115
    && workerAddressLines.length <= 2
    && regular.widthOfTextAtSize(advice.worker.taxReference, 9) <= 150
    && regular.widthOfTextAtSize(advice.worker.socialReference, 9) <= 108;
  const permanentEstimate = "ESTIMATE - informational document; confirm all inputs against official records.";
  const standardNote = "Generated from completed shifts for the selected period. Confirmed inputs are not stored.";
  const documentNotes = [permanentEstimate, standardNote, ...warningTexts];
  const footerLines = wrapPdfText(documentNotes.join(" "), width - margin * 2 - 8, 7.5, regular);
  const notesNeedContinuation = footerLines.length > 4;
  const needsContinuationPage = !compactIdentityFits || notesNeedContinuation;

  const page = document.addPage(A4_LANDSCAPE);
  drawPageBackground(page);
  page.drawRectangle({ x: margin, y: height - 74, width: width - margin * 2, height: 36, borderColor: ink, borderWidth: 1.2 });
  const title = "Salary Advice";
  drawText(page, title, (width - bold.widthOfTextAtSize(title, 19)) / 2, height - 62, 19, bold);
  page.drawRectangle({ x: width - margin - 112, y: height - 68, width: 102, height: 22, color: soft, borderColor: accent, borderWidth: 0.8 });
  drawText(page, "ESTIMATE", width - margin - 91, height - 61, 8, bold, accent);

  if (compactIdentityFits) {
    drawText(page, advice.employer.name, margin + 8, height - 94, 10, regular);
    employerAddressLines.forEach((entry, index) => drawText(page, entry, margin + 8, height - 108 - index * 11, 8, regular, muted));
  } else {
    drawText(page, "Employer and employee identity: see page 2", margin + 8, height - 98, 9, bold);
  }
  drawText(page, `Period: ${advice.period.start} to ${advice.period.end}`, width - margin - 270, height - 94, 9, bold);
  drawText(page, `Pay date: ${advice.period.payDate}`, width - margin - 270, height - 109, 9, regular);
  drawText(page, advice.period.type === "weekly" ? "Weekly - Monday to Sunday" : "Monthly - calendar month", width - margin - 270, height - 124, 8, regular, muted);

  const tableTop = height - 148;
  const tableBottom = 206;
  page.drawRectangle({ x: margin, y: tableBottom, width: tableWidth, height: tableTop - tableBottom, borderColor: ink, borderWidth: 1 });
  drawLine(page, rightX, tableBottom, rightX, tableTop);
  page.drawRectangle({ x: margin, y: tableTop - 27, width: tableWidth, height: 27, color: soft });
  drawLine(page, margin, tableTop - 27, width - margin, tableTop - 27);

  drawText(page, "Allowances", margin + 10, tableTop - 18, 9, bold);
  drawText(page, "Hours", margin + leftWidth - 135, tableTop - 18, 9, bold);
  drawRightText(page, "Amount", rightX - 12, tableTop - 18, 9, bold);
  drawText(page, "Deductions", rightX + 10, tableTop - 18, 9, bold);
  drawRightText(page, "Amount", width - margin - 12, tableTop - 18, 9, bold);

  drawText(page, advice.allowance.description, margin + 10, tableTop - 54, 10, regular);
  drawText(page, `${advice.allowance.shiftCount} completed shift${advice.allowance.shiftCount === 1 ? "" : "s"} - £${advice.allowance.hourlyRate.toFixed(2)} / hour`, margin + 10, tableTop - 69, 7.5, regular, muted);
  drawText(page, hours, margin + leftWidth - 135, tableTop - 54, 10, regular);
  drawRightText(page, money(advice.allowance.amount), rightX - 12, tableTop - 54, 10, regular);

  drawText(page, `Income Tax / ITIS ${advice.deductions.itisRate.toFixed(2)}%`, rightX + 10, tableTop - 54, 10, regular);
  drawRightText(page, money(advice.deductions.incomeTax), width - margin - 12, tableTop - 54, 10, regular);
  const socialSecurityLabel = advice.deductions.workerSocialSecuritySource === "operator_confirmed_weekly"
    ? "Employee Social Security (confirmed)"
    : `Employee Social Security ${(advice.deductions.workerSocialSecurityRate ?? 0).toFixed(2)}%`;
  drawText(page, socialSecurityLabel, rightX + 10, tableTop - 78, 10, regular);
  drawRightText(page, money(advice.deductions.workerSocialSecurity), width - margin - 12, tableTop - 78, 10, regular);

  drawLine(page, margin, tableBottom + 31, width - margin, tableBottom + 31);
  drawText(page, "Gross total", margin + 10, tableBottom + 11, 9, bold);
  drawRightText(page, money(advice.grossTaxablePay), rightX - 12, tableBottom + 11, 9, bold);
  drawText(page, "Total deductions", rightX + 10, tableBottom + 11, 9, bold);
  drawRightText(page, money(advice.deductions.total), width - margin - 12, tableBottom + 11, 9, bold);

  const lowerTop = 190;
  const lowerBottom = 70;
  page.drawRectangle({ x: margin, y: lowerBottom, width: tableWidth, height: lowerTop - lowerBottom, borderColor: ink, borderWidth: 1 });
  drawLine(page, rightX, lowerBottom, rightX, lowerTop);
  const labelX = margin + 10;
  const valueX = margin + 98;
  if (compactIdentityFits) {
    drawText(page, "Employee no.", labelX, lowerTop - 23, 8, bold, muted);
    drawText(page, advice.worker.employeeNumber, valueX, lowerTop - 23, 9, regular);
    drawText(page, "Employee", labelX, lowerTop - 44, 8, bold, muted);
    drawText(page, advice.worker.legalName, valueX, lowerTop - 44, 9, regular);
    drawText(page, "Address", labelX, lowerTop - 65, 8, bold, muted);
    workerAddressLines.forEach((entry, index) => drawText(page, entry, valueX, lowerTop - 65 - index * 11, 8, regular, muted));
    drawText(page, "Tax Ref", labelX, lowerTop - 94, 8, bold, muted);
    drawText(page, advice.worker.taxReference, valueX, lowerTop - 94, 9, regular);
    drawText(page, "Social Ref", margin + leftWidth - 185, lowerTop - 94, 8, bold, muted);
    drawText(page, advice.worker.socialReference, margin + leftWidth - 118, lowerTop - 94, 9, regular);
  } else {
    drawText(page, "Full employer and employee identity is preserved on page 2.", labelX, lowerTop - 39, 9, bold);
    drawText(page, "No legal name, address or reference has been shortened.", labelX, lowerTop - 58, 8, regular, muted);
  }

  drawText(page, "This advice", rightX + 10, lowerTop - 21, 9, bold, accent);
  drawText(page, "Net Pay", rightX + 10, lowerTop - 43, 10, bold);
  drawRightText(page, money(advice.netPay), width - margin - 12, lowerTop - 43, 11, bold);
  drawLine(page, rightX + 10, lowerTop - 53, width - margin - 10, lowerTop - 53, 0.8);
  drawText(page, "Totals to Date (confirmed)", rightX + 10, lowerTop - 70, 8, bold, muted);
  drawText(page, "Gross Taxable Pay", rightX + 10, lowerTop - 91, 9, bold);
  drawRightText(page, money(advice.totalsToDate.grossTaxablePay), width - margin - 12, lowerTop - 91, 9, regular);
  drawText(page, "Tax Paid", rightX + 10, lowerTop - 111, 9, bold);
  drawRightText(page, money(advice.totalsToDate.taxPaid), width - margin - 12, lowerTop - 111, 9, regular);

  const mainFooter = notesNeedContinuation
    ? `${permanentEstimate} See page 2 for all document notes.`
    : documentNotes.join(" ");
  drawWrapped(page, mainFooter, margin + 4, 49, width - margin * 2 - 8, 7.5, regular, ink);

  if (needsContinuationPage) {
    const detailPage = document.addPage(A4_LANDSCAPE);
    drawPageBackground(detailPage);
    detailPage.drawRectangle({ x: margin, y: height - 74, width: width - margin * 2, height: 36, borderColor: ink, borderWidth: 1.2 });
    drawText(detailPage, "Salary Advice - full identity and notes", margin + 12, height - 62, 16, bold);
    detailPage.drawRectangle({ x: width - margin - 112, y: height - 68, width: 102, height: 22, color: soft, borderColor: accent, borderWidth: 0.8 });
    drawText(detailPage, "ESTIMATE", width - margin - 91, height - 61, 8, bold, accent);
    drawText(detailPage, `Period: ${advice.period.start} to ${advice.period.end}`, margin + 12, height - 94, 8, regular, muted);
    let cursor = height - 122;
    const detail = (label: string, value: string) => {
      drawText(detailPage, label, margin + 8, cursor, 8, bold, accent);
      const lines = drawWrapped(detailPage, value, margin + 150, cursor, width - margin * 2 - 158, 8.5, regular, ink);
      cursor -= Math.max(1, lines.length) * 11.5 + 12;
    };
    detail("Employer name", advice.employer.name);
    detail("Employer address", advice.employer.address);
    detail("Employee number", advice.worker.employeeNumber);
    detail("Employee legal name", advice.worker.legalName);
    detail("Employee address", advice.worker.address);
    detail("Tax Ref", advice.worker.taxReference);
    detail("Social Ref", advice.worker.socialReference);
    cursor -= 4;
    drawText(detailPage, permanentEstimate, margin + 8, Math.max(24, cursor), 7.5, bold, accent);
    cursor -= 18;
    if (notesNeedContinuation) {
      drawText(detailPage, "Document notes", margin + 8, cursor, 10, bold);
      cursor -= 17;
      documentNotes.forEach((note) => {
        const lines = drawWrapped(detailPage, note, margin + 18, cursor, width - margin * 2 - 26, 8, regular, ink);
        cursor -= lines.length * 11 + 5;
      });
    }
  }

  return document.save({ useObjectStreams: false });
}

export async function downloadSalaryAdvicePdf(advice: SalaryAdvice): Promise<string> {
  const bytes = await createSalaryAdvicePdf(advice);
  const filename = salaryAdviceFilename(advice);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return filename;
}
