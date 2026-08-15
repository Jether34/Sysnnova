import ExcelJS from "exceljs";

const METADATA_ROWS = 12;
const HEADER_ROW = 13;
const FIRST_DATA_ROW = 14;

export function fullName(u) {
  return [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ").trim();
}

function fileNameFor({ subject, gradeLevel, strand, section, tvlStrand, specialization }) {
  const subj = (subject || "Grades").trim().replace(/\s+/g, "_");
  const parts = [subj, gradeLevel];
  if (strand) parts.push(strand.replace(/\s+/g, "_"));
  if (tvlStrand) parts.push(tvlStrand.replace(/\s+/g, "_"));
  if (specialization) parts.push(specialization.replace(/\s+/g, "_"));
  parts.push(section);
  return `${parts.join("_")}.xlsx`;
}

/**
 * Builds the downloadable grading template workbook.
 * students: sorted Male-first / Female after; each { firstName, middleName, lastName, gender }
 * adviserName: full name string
 * school: { name, province, city, barangay } - printed as a header on top
 */
export async function buildTemplate({ gradeLevel, strand, section, academicYear, tvlStrand, specialization, adviserName, students, subject, school }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AgriMind Grades";
  const ws = wb.addWorksheet("Grades");

  const schoolName = school?.name?.trim();
  const schoolLine = schoolName
    ? `${schoolName} of ${school.province}, ${school.city}, ${school.barangay}`
    : "School not set";
  ws.mergeCells(`A1:D1`);
  const title = ws.getCell("A1");
  title.value = schoolLine;
  title.font = { bold: true, size: 14 };
  title.alignment = { vertical: "middle" };

  const meta = [
    ["School", school?.name || ""],
    ["Province", school?.province || ""],
    ["City/Municipality", school?.city || ""],
    ["Barangay", school?.barangay || ""],
    ["Academic Year", academicYear],
    ["Grade", gradeLevel],
    ["Strand", strand || ""],
    ["TVL Track", tvlStrand || ""],
    ["Specialization", specialization || ""],
    ["Section/Block", section],
    ["Adviser", adviserName || ""],
  ];
  meta.forEach(([k, v], i) => {
    const r = i + 2;
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`B${r}`).value = v;
    ws.getCell(`A${r}`).font = { bold: true };
  });

  const boys = students.filter((s) => s.gender === "Male");
  const girls = students.filter((s) => s.gender === "Female");

  const header = ["First name", "Middle name", "Last name", "Grade"];
  const headerCells = [`A${HEADER_ROW}`, `B${HEADER_ROW}`, `C${HEADER_ROW}`, `D${HEADER_ROW}`];
  headerCells.forEach((cell, i) => {
    ws.getCell(cell).value = header[i];
    ws.getCell(cell).font = { bold: true };
    ws.getCell(cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
  });

  let row = FIRST_DATA_ROW;
  const write = (list) =>
    list.forEach((s) => {
      ws.getCell(`A${row}`).value = s.firstName;
      ws.getCell(`B${row}`).value = s.middleName || "";
      ws.getCell(`C${row}`).value = s.lastName;
      ws.getCell(`D${row}`).value = s.gradeValue ?? "";
      row += 1;
    });

  // Girls first then boys
  write(girls);
  write(boys);

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 12;

  const buf = await wb.xlsx.writeBuffer();
  return { buffer: buf, filename: fileNameFor({ subject, gradeLevel, strand, section, tvlStrand, specialization }) };
}

/**
 * Parses an uploaded grade workbook back into structured data.
 * Returns { academicYear, gradeLevel, strand, tvlStrand, specialization, section, adviserName, school: {name,province,city,barangay}, students: [{firstName,middleName,lastName,grade}] }
 */
export async function parseSubmission(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];

  const readMeta = (key) => {
    for (let r = 1; r <= METADATA_ROWS; r += 1) {
      const k = ws.getCell(`A${r}`).value?.toString().trim().toLowerCase() ?? "";
      if (k === key.toLowerCase()) return ws.getCell(`B${r}`).value?.toString().trim() ?? "";
    }
    return "";
  };

  // Locate header row
  let headerRow = 0;
  ws.eachRow((row, r) => {
    const a = row.getCell(1).value?.toString().toLowerCase() ?? "";
    if (a === "first name") headerRow = r;
  });
  if (!headerRow) throw new Error("Invalid file format: 'First name' header not found.");

  const students = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const firstName = ws.getCell(`A${r}`).value?.toString().trim() ?? "";
    const middleName = ws.getCell(`B${r}`).value?.toString().trim() ?? "";
    const lastName = ws.getCell(`C${r}`).value?.toString().trim() ?? "";
    const grade = ws.getCell(`D${r}`).value;
    if (!firstName && !lastName) continue;
    students.push({ firstName, middleName, lastName, grade });
  }

  return {
    academicYear: readMeta("Academic Year"),
    gradeLevel: readMeta("Grade"),
    strand: readMeta("Strand"),
    tvlStrand: readMeta("TVL Track"),
    specialization: readMeta("Specialization"),
    section: readMeta("Section/Block"),
    adviserName: readMeta("Adviser"),
    school: {
      name: readMeta("School"),
      province: readMeta("Province"),
      city: readMeta("City/Municipality"),
      barangay: readMeta("Barangay"),
    },
    students,
  };
}
