import PDFDocument from "pdfkit";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const M = 48;
const USABLE = PAGE.width - M * 2;
const COLS = [
  { key: "#", w: 0.06, align: "center" },
  { key: "Student", w: 0.4, align: "left" },
  { key: "WW", w: 0.13, align: "center" },
  { key: "PT", w: 0.13, align: "center" },
  { key: "QA", w: 0.13, align: "center" },
  { key: "Grade", w: 0.13, align: "center" },
];

function frac(score, item) {
  if (score === null || score === undefined || score === "") return "—";
  const n = Number(score);
  const it = Number(item);
  return Number.isFinite(n) ? (it > 0 ? `${n}/${it}` : String(n)) : String(score);
}

function cellX(i) {
  let x = M;
  for (let j = 0; j < i; j += 1) x += COLS[j].w * USABLE;
  return x;
}

export function buildGradeSheetPdf({ school, subject, semester, academicYear, gradeLevel, strand, tvlStrand, specialization, section, teacherName, entries = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const schoolName = typeof school === "object" && school ? school.name || "" : school || "";
    doc.fontSize(16).font("Helvetica-Bold").text(schoolName, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(13).text("Grade Sheet", { align: "center" });
    doc.moveDown(0.6);

    doc.font("Helvetica").fontSize(10);
    doc.text(`Subject: ${subject}`);
    doc.text(`Class: Grade ${gradeLevel}${strand && strand !== "N/A" ? ` · ${strand}` : ""}${tvlStrand ? ` · ${tvlStrand}` : ""}${specialization ? ` (${specialization})` : ""} - Block ${section}`);
    doc.text(`Semester: ${semester}    S.Y.: ${academicYear}`);
    doc.text(`Submitted by: ${teacherName}`);
    doc.moveDown(0.8);

    const drawHeader = () => {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      COLS.forEach((c, i) => doc.text(c.key, cellX(i), y, { width: c.w * USABLE, align: c.align }));
      doc.moveTo(M, y + 12).lineTo(PAGE.width - M, y + 12).strokeColor("#334155").stroke();
      doc.y = y + 16;
    };
    drawHeader();

    entries.forEach((e, idx) => {
      if (doc.y > PAGE.height - M - 24) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      const cells = [
        String(idx + 1),
        `${e.lastName}, ${e.firstName}`,
        frac(e.ww, e.wwItems),
        frac(e.pt, e.ptItems),
        frac(e.qa, e.qaItems),
        String(e.grade ?? "—"),
      ];
      doc.font("Helvetica").fontSize(9);
      COLS.forEach((c, i) => doc.text(cells[i], cellX(i), y, { width: c.w * USABLE, align: c.align }));
      doc.moveTo(M, y + 12).lineTo(PAGE.width - M, y + 12).strokeColor("#e2e8f0").stroke();
      doc.y = y + 16;
    });

    if (entries.length === 0) {
      doc.fontSize(9).text("No student entries.", { align: "center" });
    }

    doc.end();
  });
}
