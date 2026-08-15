import ExcelJS from "exceljs";
import { remarkFor } from "./compute.js";

const RATING_SCALE = [
  [90, 100, "Outstanding"],
  [85, 89, "Very Satisfactory"],
  [80, 84, "Satisfactory"],
  [75, 79, "Fairly Satisfactory"],
  [0, 74, "Did Not Meet Expectations"],
];

export function reportCardFileName({ gradeLevel, strand, tvlStrand, specialization, section, semester }) {
  const parts = ["Report_Cards", `G${gradeLevel}`];
  if (strand) parts.push(strand);
  if (tvlStrand) parts.push(tvlStrand.replace(/[^A-Za-z0-9]+/g, "_"));
  if (specialization) parts.push(specialization.replace(/[^A-Za-z0-9]+/g, "_"));
  parts.push(`Block${section || ""}`);
  if (semester) parts.push(String(semester).replace(/[^A-Za-z0-9]+/g, "_"));
  return `${parts.join("_")}.xlsx`;
}

function writeRatingScale(ws, startRow) {
  ws.getCell(`A${startRow}`).value = "Rating Scale:";
  ws.getCell(`A${startRow}`).font = { bold: true };
  RATING_SCALE.forEach(([lo, hi, label], i) => {
    const r = startRow + 1 + i;
    ws.getCell(`A${r}`).value = `${lo} - ${hi}`;
    ws.getCell(`B${r}`).value = label;
    ws.getCell(`B${r}`).alignment = { horizontal: "left" };
    ws.mergeCells(`B${r}:D${r}`);
  });
}

function styleReportHeader(ws, row, title) {
  ws.mergeCells(`A${row}:D${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = title;
  cell.alignment = { horizontal: "center" };
  cell.font = { bold: true, size: 14 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
  ws.getRow(row).height = 24;
}

/**
 * Adviser report cards: one worksheet per student.
 * students: [{ firstName, middleName, lastName, gender, grades: [{ subject, grade }] }]
 */
export async function buildReportCardsWorkbook({
  school,
  semester,
  academicYear,
  gradeLevel,
  strand,
  tvlStrand,
  specialization,
  section,
  adviserName,
  students,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sysnnova Grades";

  const schoolLine = school
    ? `${school.name} of ${school.province}, ${school.city}, ${school.barangay}`
    : "School not set";

  for (const st of students) {
    const ws = wb.addWorksheet(`${st.lastName}, ${st.firstName}`.slice(0, 31));
    ws.columns = [{ width: 6 }, { width: 34 }, { width: 12 }, { width: 24 }];

    styleReportHeader(ws, 1, schoolLine);
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = "Learner's Progress Report Card";
    ws.getCell("A2").alignment = { horizontal: "center" };
    ws.getCell("A2").font = { bold: true, size: 12 };

    const full = [st.lastName, `${st.firstName}${st.middleName ? " " + st.middleName.charAt(0) + "." : ""}`].join(", ");
    const meta = [
      `Name: ${full}`,
      `Grade Level: ${gradeLevel}${strand ? `   Strand: ${strand}` : ""}${tvlStrand ? `   TVL Track: ${tvlStrand}` : ""}${specialization ? `   Specialization: ${specialization}` : ""}   Section/Block: ${section}`,
      `Academic Year: ${academicYear}   ${semester || ""}`,
      `Class Adviser: ${adviserName || ""}`,
    ];
    meta.forEach((txt, i) => {
      const r = 4 + i;
      ws.getCell(`A${r}`).value = txt;
      ws.mergeCells(`A${r}:D${r}`);
    });

    const headerRow = 9;
    ["No.", "Subject", "Grade", "Remarks"].forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
    });

    const sorted = [...(st.grades || [])].sort((a, b) => a.subject.localeCompare(b.subject));
    sorted.forEach((g, i) => {
      const r = headerRow + 1 + i;
      ws.getCell(`A${r}`).value = i + 1;
      ws.getCell(`B${r}`).value = g.subject;
      const gradeCell = ws.getCell(`C${r}`);
      gradeCell.value = typeof g.grade === "number" ? g.grade : g.grade;
      gradeCell.alignment = { horizontal: "center" };
      ws.getCell(`D${r}`).value = remarkFor(g.grade);
    });

    writeRatingScale(ws, headerRow + sorted.length + 2);
  }

  return { buffer: await wb.xlsx.writeBuffer() };
}

/**
 * Student report card: one worksheet per semester.
 * semesters: [{ semester, academicYear, grades: [{ subject, teacherName, grade }] }]
 */
export async function buildStudentReportCardWorkbook({ user, school, semesters }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sysnnova Grades";

  const schoolLine = school
    ? `${school.name} of ${school.province}, ${school.city}, ${school.barangay}`
    : "School not set";

  for (const sem of semesters) {
    const ws = wb.addWorksheet(String(sem.semester || "Report").slice(0, 31));
    ws.columns = [{ width: 6 }, { width: 34 }, { width: 12 }, { width: 24 }];

    styleReportHeader(ws, 1, schoolLine);
    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = "Learner's Progress Report Card";
    ws.getCell("A2").alignment = { horizontal: "center" };
    ws.getCell("A2").font = { bold: true, size: 12 };

    const full = [user.lastName, `${user.firstName}${user.middleName ? " " + user.middleName.charAt(0) + "." : ""}`].join(", ");
    const meta = [
      `Name: ${full}`,
      `Grade Level: ${user.grade}${user.strand ? `   Strand: ${user.strand}` : ""}${user.tvlStrand ? `   TVL Track: ${user.tvlStrand}` : ""}${user.specialization ? `   Specialization: ${user.specialization}` : ""}   Section/Block: ${user.section}`,
      `Academic Year: ${sem.academicYear}   ${sem.semester}`,
    ];
    meta.forEach((txt, i) => {
      const r = 4 + i;
      ws.getCell(`A${r}`).value = txt;
      ws.mergeCells(`A${r}:D${r}`);
    });

    const headerRow = 8;
    ["No.", "Subject", "Grade", "Remarks"].forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
    });

    (sem.grades || []).forEach((g, i) => {
      const r = headerRow + 1 + i;
      ws.getCell(`A${r}`).value = i + 1;
      ws.getCell(`B${r}`).value = g.subject;
      const gc = ws.getCell(`C${r}`);
      gc.value = g.grade;
      gc.alignment = { horizontal: "center" };
      ws.getCell(`D${r}`).value = remarkFor(g.grade);
    });

    writeRatingScale(ws, headerRow + (sem.grades || []).length + 2);
  }

  return { buffer: await wb.xlsx.writeBuffer() };
}
