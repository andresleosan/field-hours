import assert from "node:assert/strict";
import * as XLSX from "xlsx";

assert.equal(XLSX.version, "0.20.3", "The patched SheetJS version must stay pinned");

const rows = [
  { Worker: "Synthetic Worker", Hours: 7.5, Project: "Synthetic Site" },
  { Worker: "Second Worker", Hours: 4.25, Project: "Synthetic Site" },
];
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(workbook, worksheet, "Shifts");

const serialized = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
assert(serialized instanceof ArrayBuffer, "SheetJS must serialize the workbook in browser-compatible form");

const parsed = XLSX.read(serialized, { type: "array" });
const parsedWorksheet = parsed.Sheets.Shifts;
assert(parsedWorksheet, "The serialized worksheet must be readable");
assert.deepEqual(XLSX.utils.sheet_to_json(parsedWorksheet), rows);
assert.match(XLSX.utils.sheet_to_csv(parsedWorksheet), /Synthetic Worker,7\.5,Synthetic Site/);

console.log("SheetJS 0.20.3 smoke passed: browser-style write, read, JSON and CSV conversion.");
