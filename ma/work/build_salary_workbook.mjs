import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const destination = "C:/Users/hsc/Desktop/dikshya/dikshya_salary.xlsx";
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Salary");

const months = [
  [new Date(2025, 8, 1), 10],
  [new Date(2025, 9, 1), 10],
  [new Date(2025, 10, 1), 10],
  [new Date(2025, 11, 1), 10],
  [new Date(2026, 0, 1), 10],
  [new Date(2026, 1, 1), 10],
  [new Date(2026, 2, 1), 10],
  [new Date(2026, 3, 1), 10],
  [new Date(2026, 4, 1), 10],
  [new Date(2026, 5, 1), 10],
  [new Date(2026, 6, 1), 10],
  [new Date(2026, 7, 1), 10],
];

sheet.getRange("A1:B1").merge();
sheet.getRange("A1").values = [["Dikshya's Monthly Salary"]];
sheet.getRange("A2").values = [["Period: September 2025 to August 2026"]];
sheet.getRange("A4:B4").values = [["Month", "Salary (NPR)"]];
sheet.getRange("A5:B16").values = months;
sheet.getRange("A17").values = [["Total"]];
sheet.getRange("B17").formulas = [["=SUM(B5:B16)"]];

sheet.showGridLines = false;
sheet.getRange("A1:B1").format = {
  fill: "#1F4E78",
  font: { name: "Arial", size: 14, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:B1").format.rowHeight = 28;
sheet.getRange("A2:B2").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#595959" },
};
sheet.getRange("A4:B4").format = {
  fill: "#244062",
  font: { name: "Arial", size: 11, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A5:B16").format = { font: { name: "Arial", size: 11 } };
sheet.getRange("A5:B16").format.borders = { preset: "insideHorizontal", style: "thin", color: "#D9E2F3" };
sheet.getRange("A17:B17").format = {
  fill: "#D9EAF7",
  font: { name: "Arial", size: 11, bold: true, color: "#1F1F1F" },
};
sheet.getRange("A17:B17").format.borders = { preset: "doubleBottom", style: "medium", color: "#1F4E78" };
sheet.getRange("A5:A16").format.numberFormat = "mmm yyyy";
sheet.getRange("B5:B17").format.numberFormat = '"NPR" #,##0';
sheet.getRange("A1:A17").format.columnWidth = 24;
sheet.getRange("B1:B17").format.columnWidth = 18;
sheet.getRange("B5:B17").format.horizontalAlignment = "right";

const tableCheck = await workbook.inspect({
  kind: "table",
  range: "Salary!A1:B17",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 4,
});
console.log(tableCheck.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "Salary", range: "A1:B17", scale: 2, format: "png" });
await fs.mkdir("C:/Users/hsc/Documents/Codex/2026-09-08/ma/work", { recursive: true });
await fs.writeFile("C:/Users/hsc/Documents/Codex/2026-09-08/ma/work/salary_preview.png", new Uint8Array(await preview.arrayBuffer()));
await fs.mkdir("C:/Users/hsc/Desktop/dikshya", { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(destination);
