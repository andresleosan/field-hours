import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import {
  createSalaryAdvicePdf,
  salaryAdviceFilename,
} from "../src/lib/salaryAdvicePdf.ts";

const pdfFonts = {
  primary: new Uint8Array(await readFile(new URL("../node_modules/@fontsource-variable/archivo/files/archivo-latin-ext-standard-normal.woff2", import.meta.url))),
  unicodeFallback: new Uint8Array(await readFile(new URL("../node_modules/@fontsource/unifont/files/unifont-latin-400-normal.woff", import.meta.url))),
};

const advice = {
  calculatedAt: "2026-08-30T12:00:00.000Z",
  currency: "GBP",
  isEstimate: true,
  period: { type: "monthly", start: "2026-08-01", end: "2026-08-31", payDate: "2026-09-01" },
  employer: { name: "Libertys - Quayside Kitchen", address: "Libertys, St Helier, Jersey" },
  worker: {
    userId: "worker-1",
    displayName: "Federico De Freitas",
    legalName: "Mr Federico De Freitas",
    address: "5 Harbour Street, St Helier",
    employeeNumber: "D013",
    taxReference: "NX17903",
    socialReference: "JY438805C",
  },
  allowance: {
    description: "Basic Hourly Pay",
    shiftCount: 10,
    netMinutes: 4410,
    hours: 73.5,
    hourlyRate: 11,
    amount: 808.5,
  },
  deductions: {
    itisRate: 15,
    incomeTax: 121.28,
    workerSocialSecurityRate: 6,
    workerSocialSecurity: 48.48,
    workerSocialSecuritySource: "calculated_monthly",
    total: 169.76,
  },
  totalsToDate: {
    grossTaxablePay: 17_928.5,
    taxPaid: 2_554.08,
    source: "operator_confirmed",
  },
  grossTaxablePay: 808.5,
  netPay: 638.74,
  warnings: [],
};

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

function countDarkPixels(context, { x, y, width, height }) {
  const pixels = context.getImageData(x, y, width, height).data;
  let darkPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 190 && pixels[index + 1] < 190 && pixels[index + 2] < 190 && pixels[index + 3] > 0) {
      darkPixels += 1;
    }
  }
  return darkPixels;
}

async function extractPdfText(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const renderedDocument = await getDocument({
    data: bytes,
    disableWorker: true,
    standardFontDataUrl: `${fileURLToPath(new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)).replaceAll("\\", "/")}/`,
  }).promise;
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= renderedDocument.numPages; pageNumber += 1) {
    const page = await renderedDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return { renderedDocument, pageTexts, text: pageTexts.join(" ") };
}

test("Salary Advice is a deterministic one-page A4 landscape PDF", async () => {
  assert.equal(
    salaryAdviceFilename(advice),
    "salary-advice_D013_2026-08-01_2026-08-31.pdf",
  );

  const bytes = await createSalaryAdvicePdf(advice, pdfFonts);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");

  const structure = await PDFDocument.load(bytes);
  assert.equal(structure.getPageCount(), 1);
  const { width, height } = structure.getPage(0).getSize();
  assert.ok(Math.abs(width - 841.89) < 0.02);
  assert.ok(Math.abs(height - 595.28) < 0.02);

  await mkdir(new URL("../test-results/", import.meta.url), { recursive: true });
  await writeFile(new URL("../test-results/salary-advice-sample.pdf", import.meta.url), bytes);

  const { renderedDocument, text: extractedText } = await extractPdfText(bytes);
  const renderedPage = await renderedDocument.getPage(1);
  for (const expected of [
    "Salary Advice",
    "ESTIMATE",
    "informational document",
    "Basic Hourly Pay",
    "Mr Federico De Freitas",
    "D013",
    "NX17903",
    "JY438805C",
    "Gross Taxable Pay",
    "17,928.50",
    "Tax Paid",
    "2,554.08",
    "Net Pay",
    "638.74",
  ]) {
    assert.match(extractedText, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(
    extractedText,
    /Employer Social Security|Employer Cost|Business Tax|Business Social|Approved|Review|Payment ready|Bacs|Bank/i,
  );

  const viewport = renderedPage.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await renderedPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  await writeFile(
    new URL("../test-results/salary-advice-sample.png", import.meta.url),
    canvas.toBuffer("image/png"),
  );
  await renderedDocument.destroy();
});

test("weekly PDF identifies Social Security as confirmed and never invents a rate", async () => {
  const weekly = {
    ...advice,
    period: { type: "weekly", start: "2026-08-24", end: "2026-08-30", payDate: "2026-08-30" },
    deductions: {
      ...advice.deductions,
      workerSocialSecurityRate: null,
      workerSocialSecuritySource: "operator_confirmed_weekly",
    },
    warnings: ["WEEKLY_SOCIAL_SECURITY_RECONCILIATION_REQUIRED"],
  };
  const bytes = await createSalaryAdvicePdf(weekly, pdfFonts);
  const { renderedDocument, text: extractedText } = await extractPdfText(bytes);
  assert.match(extractedText, /Employee Social Security \(confirmed\)/);
  assert.match(extractedText, /running calendar-month record/);
  assert.match(extractedText, /ESTIMATE/);
  assert.doesNotMatch(extractedText, /Employee Social Security 6/);
  await renderedDocument.destroy();
});

test("long valid identity is preserved in full on a continuation page", async () => {
  const longAdvice = {
    ...advice,
    employer: {
      name: `Empresa ${"A".repeat(152)}`,
      address: `Dirección ${"B".repeat(240)}`,
    },
    worker: {
      ...advice.worker,
      legalName: `Flávia Gonçalves ${"C".repeat(143)}`,
      address: `Morada ${"D".repeat(243)}`,
      employeeNumber: `EMP-${"E".repeat(36)}`,
      taxReference: `TAX-${"F".repeat(76)}`,
      socialReference: `SOC-${"G".repeat(76)}`,
    },
  };
  const bytes = await createSalaryAdvicePdf(longAdvice, pdfFonts);
  const structure = await PDFDocument.load(bytes);
  assert.equal(structure.getPageCount(), 2);
  const { renderedDocument, pageTexts, text } = await extractPdfText(bytes);
  const compactText = text.replace(/\s+/g, "");
  assert.equal(pageTexts.length, 2);
  pageTexts.forEach((pageText) => assert.match(pageText, /ESTIMATE/));
  for (const value of [
    longAdvice.employer.name,
    longAdvice.employer.address,
    longAdvice.worker.legalName,
    longAdvice.worker.address,
    longAdvice.worker.employeeNumber,
    longAdvice.worker.taxReference,
    longAdvice.worker.socialReference,
  ]) {
    assert.ok(compactText.includes(value.replace(/\s+/g, "")), `missing full value ending in ${value.slice(-12)}`);
  }
  assert.doesNotMatch(text, /\.\.\./);
  const continuation = await renderedDocument.getPage(2);
  const viewport = continuation.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await continuation.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  await writeFile(
    new URL("../test-results/salary-advice-long-page-2.png", import.meta.url),
    canvas.toBuffer("image/png"),
  );
  await renderedDocument.destroy();
});

test("Unicode legal identities are embedded without substitution", async () => {
  const unicodeAdvice = {
    ...advice,
    employer: { ...advice.employer, name: "Café Łódź 李" },
    worker: {
      ...advice.worker,
      legalName: "李雷 · Łukasz Gonçalves",
      address: "港口街 5, St Helier",
    },
  };
  const bytes = await createSalaryAdvicePdf(unicodeAdvice, pdfFonts);
  const { renderedDocument, text } = await extractPdfText(bytes);
  for (const value of [unicodeAdvice.employer.name, unicodeAdvice.worker.legalName, unicodeAdvice.worker.address]) {
    assert.ok(text.includes(value), `missing Unicode value: ${value}`);
  }
  const page = await renderedDocument.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  const renderedDynamicRegions = [
    { label: "employer identity", x: 80, y: 155, width: 620, height: 80 },
    { label: "allowance row", x: 80, y: 370, width: 560, height: 65 },
    { label: "employee identity", x: 250, y: 820, width: 650, height: 150 },
  ];
  for (const region of renderedDynamicRegions) {
    const darkPixels = countDarkPixels(context, region);
    assert.ok(
      darkPixels > 40,
      `Unicode custom font rendered blank in ${region.label} (${darkPixels} dark pixels)`,
    );
  }
  await writeFile(
    new URL("../test-results/salary-advice-unicode.png", import.meta.url),
    canvas.toBuffer("image/png"),
  );
  await renderedDocument.destroy();
});

test("complex right-to-left layout fails closed instead of altering a legal address", async () => {
  await assert.rejects(
    createSalaryAdvicePdf({
      ...advice,
      worker: { ...advice.worker, address: "شارع الميناء 5, St Helier" },
    }, pdfFonts),
    /cannot safely lay out every character in employee address.*no document was generated.*before changing any legal identity data/i,
  );
});

test("a genuinely missing glyph fails before a corrupted PDF can be generated", async () => {
  await assert.rejects(
    createSalaryAdvicePdf({
      ...advice,
      worker: { ...advice.worker, legalName: `Worker ${String.fromCodePoint(0x10ffff)}` },
    }, pdfFonts),
    /cannot represent every character in employee legal name.*no document was generated.*before changing any legal identity data/i,
  );
});
