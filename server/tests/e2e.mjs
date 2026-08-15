import ExcelJS from "exceljs";
import { buildTemplate, parseSubmission, fullName } from "../src/services/excel.js";
import mongoose from "mongoose";
import { webcrypto } from "crypto";
import User from "../src/models/User.js";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/agrimind";

await mongoose.connect(MONGO_URI);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
console.log(`[test] database reset on ${MONGO_URI}`);
let log = console.log;

const subtle = webcrypto.subtle;
function b64ToU8(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
async function hybridRoundTrip(publicKey, privateKey, plaintext) {
  const encKey = await subtle.importKey("spki", b64ToU8(publicKey), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const decKey = await subtle.importKey("pkcs8", b64ToU8(privateKey), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext));
  const raw = await subtle.exportKey("raw", aesKey);
  const wrapped = await subtle.encrypt({ name: "RSA-OAEP" }, encKey, raw);
  const unwrapped = await subtle.decrypt({ name: "RSA-OAEP" }, decKey, wrapped);
  const aes2 = await subtle.importKey("raw", unwrapped, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv }, aes2, ct);
  return new TextDecoder().decode(pt) === plaintext;
}

async function req(method, path, { body, cookie, form, query, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (cookie) headers.cookie = cookie;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    path += (path.includes("?") ? "&" : "?") + qs;
  }
  if (form) {
    body = form;
  } else if (body && !(body instanceof FormData)) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.()?.[0] || "";
  const ctype = res.headers.get("content-type") || "";
  let data;
  if (ctype.includes("json")) data = await res.json();
  else data = await res.arrayBuffer();
  return { status: res.status, data, cookie: setCookie.split(";")[0], headers: Object.fromEntries(res.headers.entries()) };
}

async function login(path, body, deviceId = "test-device-1", extraHeaders = {}) {
  const headers = {};
  if (deviceId) headers["x-device-id"] = deviceId;
  headers["x-device-name"] = headers["x-device-name"] || "Test Device";
  headers["x-platform"] = headers["x-platform"] || "test";
  return req("POST", path, { body, extraHeaders: { ...headers, ...extraHeaders } });
}

async function schoolSignup(school, body, deviceId = "test-device-1") {
  return login("/auth/signup", { ...body, school }, deviceId);
}

async function sheetText(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  return ws.getCell("A1").value?.toString() || "";
}

const results = [];
function check(name, cond, extra = "") {
  results.push([name, cond, extra]);
  log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
}

// ---- 0. Schools ----
const schoolA = { name: "STI College", province: "Pampanga", city: "City of San Fernando", barangay: "Dolores" };
const schoolB = { name: "STI College", province: "Bulacan", city: "City of Malolos", barangay: "San Fernando" };
const schoolC = { name: "STI College", province: "Pampanga", city: "City of San Fernando", barangay: "San Agustin" };
let r = await req("POST", "/schools", { body: schoolA });
check("school A registered", r.status === 201, `got ${r.status}`);
const schoolAId = r.data?.school?.id;
r = await req("POST", "/schools", { body: schoolA });
check("duplicate school A rejected 409", r.status === 409, r.data?.error);
r = await req("POST", "/schools", { body: schoolB });
check("school B registered (same name, diff province)", r.status === 201, `got ${r.status}`);
const schoolBId = r.data?.school?.id;
r = await req("POST", "/schools", { body: schoolC });
check("school C registered (same name+province+city, diff barangay)", r.status === 201, `got ${r.status}`);
const schoolCId = r.data?.school?.id;
r = await req("GET", "/schools");
check("GET /schools includes the 3 test schools", [schoolA.name, schoolB.name, schoolC.name].every((n) => r.data?.schools?.some((s) => s.name === n)), `len=${r.data?.schools?.length}`);
r = await req("GET", "/schools", { query: { province: "Pampanga", city: "City of San Fernando", barangay: "Dolores" } });
check("GET /schools filters by province+city+barangay", r.data?.schools?.some((s) => s.name === schoolA.name), `len=${r.data?.schools?.length}`);
r = await req("GET", "/schools/provinces");
check("GET /schools/provinces includes Pampanga", Array.isArray(r.data?.provinces) && r.data.provinces.includes("Pampanga"), `count=${r.data?.provinces?.length}`);
r = await req("GET", "/schools/cities", { query: { province: "Pampanga" } });
check("GET /schools/cities includes City of San Fernando", Array.isArray(r.data?.cities) && r.data.cities.includes("City of San Fernando"), `count=${r.data?.cities?.length}`);
r = await req("GET", "/schools/barangays", { query: { province: "Pampanga", city: "City of San Fernando" } });
check("GET /schools/barangays includes Dolores", Array.isArray(r.data?.barangays) && r.data.barangays.includes("Dolores"), `count=${r.data?.barangays?.length}`);

// ---- 1. Adviser signup (school A) ----
const adviser = {
  role: "adviser", firstName: "Maria", middleName: "R", lastName: "Santos", email: "adviser@school.edu.ph", password: "secret123",
  grade: "11", strand: "STEM", section: "1", academicYear: "2025-2026",
};
r = await schoolSignup(schoolA, adviser);
check("adviser signup 201", r.status === 201, `got ${r.status}`);
const adviserCookie = r.cookie;
const adviserId = r.data?.user?.id;
const adviserKeys = { publicKey: r.data?.user?.publicKey, privateKey: r.data?.user?.privateKey };
check("adviser receives real RSA public key", !!adviserKeys.publicKey && adviserKeys.publicKey.length > 500, `len=${adviserKeys.publicKey?.length}`);
check("adviser receives real RSA private key", !!adviserKeys.privateKey && adviserKeys.privateKey.length > 2000, `len=${adviserKeys.privateKey?.length}`);
check("adviser keypair encrypts/decrypts", await hybridRoundTrip(adviserKeys.publicKey, adviserKeys.privateKey, "secret-msg"), "");
check("adviser belongs to school A", r.data?.user?.school?.province === "Pampanga", JSON.stringify(r.data?.user?.school));

// 2. duplicate adviser must fail
r = await schoolSignup(schoolA, { ...adviser, email: "adviser2@school.edu.ph" });
check("duplicate adviser rejected 409", r.status === 409, r.data?.error);

// 3. teacher signup
const teacher = {
  role: "teacher", firstName: "Jose", middleName: "", lastName: "Reyes", email: "teacher@school.edu.ph", password: "secret123",
  grade: "11", strand: "STEM", subject: "General Mathematics", semester: "1st Semester, 1st Quarter", academicYear: "2025-2026",
};
r = await schoolSignup(schoolA, teacher);
check("teacher signup 201", r.status === 201, `got ${r.status}`);
const teacherCookie = r.cookie;
const teacherId = r.data?.user?.id;
const teacherKeys = { publicKey: r.data?.user?.publicKey, privateKey: r.data?.user?.privateKey };
check("teacher receives real RSA keypair", !!teacherKeys.publicKey && !!teacherKeys.privateKey, `pub=${teacherKeys.publicKey?.length} priv=${teacherKeys.privateKey?.length}`);
check("teacher keypair encrypts/decrypts", await hybridRoundTrip(teacherKeys.publicKey, teacherKeys.privateKey, "hello"), "");

// 3a. subject must match the grade band
r = await schoolSignup(schoolA, { ...teacher, email: "teacher-bad1@school.edu.ph", subject: "Mathematics" });
check("JHS subject rejected for SHS grade 400", r.status === 400, r.data?.error);
r = await schoolSignup(schoolA, { ...teacher, email: "teacher-bad2@school.edu.ph", grade: "7", subject: "General Mathematics" });
check("SHS subject rejected for JHS grade 400", r.status === 400, r.data?.error);
r = await schoolSignup(schoolA, { ...teacher, email: "teacher-jhs@school.edu.ph", grade: "7", subject: "Mathematics", strand: "" });
check("JHS teacher (grade 7, Mathematics) accepted", r.status === 201, `got ${r.status}`);

// 4. duplicate teacher same subject must fail
r = await schoolSignup(schoolA, { ...teacher, email: "teacher2@school.edu.ph" });
check("duplicate teacher rejected 409", r.status === 409, r.data?.error);

// 5. students signup (same advisory)
const students = [
  { firstName: "Ana", middleName: "", lastName: "Cruz", gender: "Female", email: "ana@student.edu.ph" },
  { firstName: "Bong", middleName: "P", lastName: "Dela Cruz", gender: "Male", email: "bong@student.edu.ph" },
  { firstName: "Carla", middleName: "", lastName: "Mendoza", gender: "Female", email: "carla@student.edu.ph" },
  { firstName: "Dennis", middleName: "", lastName: "Ramos", gender: "Male", email: "dennis@student.edu.ph" },
];
const studentCookies = {};
const studentIds = {};
for (const s of students) {
  r = await schoolSignup(schoolA, { ...s, role: "student", grade: "11", strand: "STEM", section: "1", academicYear: "2025-2026", password: "secret123" });
  check(`student signup ${s.email.split("@")[0]} 201`, r.status === 201, `got ${r.status}`);
  check(`student ${s.email.split("@")[0]} has no keys`, !r.data?.user?.publicKey && !r.data?.user?.privateKey, "");
  studentCookies[s.email] = r.cookie;
  studentIds[s.email] = r.data?.user?.id;
}

// 6. adviser sees students + teachers
r = await req("GET", "/users/students", { cookie: adviserCookie });
check("adviser sees 4 students", r.data?.students?.length === 4, `len=${r.data?.students?.length}`);
r = await req("GET", "/users/teachers", { cookie: adviserCookie });
check("adviser sees teacher grouped by subject", !!r.data?.grouped?.["General Mathematics"], JSON.stringify(Object.keys(r.data?.grouped || {})));

// 7. teacher sees sections + adviser
r = await req("GET", "/grades/sections", { cookie: teacherCookie });
const sec = r.data?.sections?.[0];
check("teacher sees Block 1 with adviser", sec?.section === "1" && !!sec?.adviser?.name, JSON.stringify(r.data?.sections));

// 8. download format
r = await req("GET", "/grades/format?grade=11&strand=STEM&section=1&ay=2025-2026&subject=General Mathematics", { cookie: teacherCookie });
check("download format xlsx", r.status === 200 && r.data.byteLength > 0, `${r.data.byteLength} bytes`);
check("format filename is subject_grade_strand_section", (r.headers["content-disposition"] || "").includes("General_Mathematics_11_STEM_1.xlsx"), r.headers["content-disposition"]);
const downloaded = Buffer.from(r.data);
check("file has school address header A1", (await sheetText(downloaded)).includes("STI College of Pampanga, City of San Fernando, Dolores"), await sheetText(downloaded));
const parsed = await parseSubmission(downloaded);
check("parse reads school from file", parsed.school?.province === "Pampanga" && parsed.school?.name === "STI College", JSON.stringify(parsed.school));

// fill grades and re-upload
const graded = await buildTemplate({
  gradeLevel: parsed.gradeLevel, strand: parsed.strand, section: parsed.section, academicYear: parsed.academicYear,
  adviserName: parsed.adviserName, school: parsed.school,
  students: students.map((s, i) => ({ ...s, gradeValue: 80 + (i * 3) })),
});

const fd = new FormData();
fd.append("file", new Blob([graded.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fd.append("subject", "General Mathematics");
fd.append("semester", "1st Semester, 1st Quarter");
fd.append("academicYear", "2025-2026");
r = await req("POST", "/grades/upload", { cookie: teacherCookie, form: fd });
check("teacher upload grades", r.status === 201 && r.data.matched === 4, `matched=${r.data?.matched} unmatched=${r.data?.unmatched} ${r.data?.error || ""}`);

// duplicate upload must fail
const fd2 = new FormData();
fd2.append("file", new Blob([graded.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fd2.append("subject", "General Mathematics");
fd2.append("semester", "1st Semester, 1st Quarter");
fd2.append("academicYear", "2025-2026");
r = await req("POST", "/grades/upload", { cookie: teacherCookie, form: fd2 });
check("duplicate upload rejected 409", r.status === 409, r.data?.error);

// strict teaching-load check: teacher uploading a subject they do not teach is refused
const fdNotMine = new FormData();
fdNotMine.append("file", new Blob([downloaded], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fdNotMine.append("subject", "General Physics");
fdNotMine.append("semester", "1st Semester, 1st Quarter");
fdNotMine.append("academicYear", "2025-2026");
r = await req("POST", "/grades/upload", { cookie: teacherCookie, form: fdNotMine });
check("teacher upload for unassigned subject refused 403", r.status === 403, r.data?.error);

// 9. adviser dashboard shows grades grouped
r = await req("GET", "/grades/adviser", { cookie: adviserCookie });
const tree = r.data?.tree || [];
const sheet = tree[0]?.semesters?.[0]?.strands?.[0]?.sheets?.[0];
check("adviser dashboard has sheet grouped", !!sheet?.subject, JSON.stringify(tree)?.slice(0, 120));
check("sheet labeled with subject/ay/quarter semester", sheet?.subject === "General Mathematics" && sheet?.academicYear === "2025-2026" && sheet?.semester === "1st Semester, 1st Quarter");
check("sheet has teacherName", sheet?.teacherName === fullName({ firstName: "Jose", middleName: "", lastName: "Reyes" }));

// 10. publish
r = await req("POST", `/grades/${sheet.sheetId}/publish`, { cookie: adviserCookie });
check("adviser publish", r.status === 200, r.data?.message);

// 11. student sees own grade only
for (const [em, ck] of Object.entries(studentCookies)) {
  r = await req("GET", "/grades/student", { cookie: ck });
  const grades = r.data?.grades || [];
  const onlyOwn = grades.every((g) => typeof g.grade === "number");
  check(`${em.split("@")[0]} sees ${grades.length} published grade(s)`, grades.length === 1 && onlyOwn, JSON.stringify(grades));
}

// 11b. adviser can unpublish (undo), students then see nothing, republish restores
r = await req("POST", `/grades/${sheet.sheetId}/unpublish`, { cookie: adviserCookie });
check("adviser unpublish", r.status === 200, r.data?.message);
r = await req("POST", `/grades/${sheet.sheetId}/unpublish`, { cookie: adviserCookie });
check("unpublish twice is idempotent 200", r.status === 200, `got ${r.status}`);
for (const ck of Object.values(studentCookies)) {
  r = await req("GET", "/grades/student", { cookie: ck });
  check("student sees no grades after unpublish", (r.data?.grades || []).length === 0, JSON.stringify(r.data?.grades));
}
r = await req("POST", `/grades/${sheet.sheetId}/publish`, { cookie: adviserCookie });
check("adviser republish", r.status === 200, r.data?.message);
r = await req("GET", "/grades/student", { cookie: Object.values(studentCookies)[0] });
check("student sees grade after republish", (r.data?.grades || []).length === 1);


// 12. messaging E2E storage (same school)
r = await req("POST", "/messages", { cookie: adviserCookie, body: { recipientId: teacherId, ciphertext: "CIPHER", iv: "IV", wrappedKey: "WK" } });
check("adviser -> teacher message sent", r.status === 201, `got ${r.status}`);
r = await req("GET", `/messages/${teacherId}`, { cookie: adviserCookie });
check("adviser thread shows 1 message", r.data?.messages?.length === 1);
check("teacher has publicKey in peer", !!r.data?.peer?.publicKey);
r = await req("GET", "/messages/contacts", { cookie: teacherCookie });
check("teacher sees adviser contact", r.data?.contacts?.length === 1);
r = await req("POST", "/messages", { cookie: teacherCookie, body: { recipientId: adviserId, ciphertext: "C2", iv: "IV2", wrappedKey: "WK2" } });
check("teacher -> adviser reply", r.status === 201);

// clientOpId makes offline message sends idempotent on sync replay
r = await req("POST", "/messages", { cookie: teacherCookie, body: { recipientId: adviserId, ciphertext: "C3", iv: "IV3", wrappedKey: "WK3", clientOpId: "clientop-1" } });
check("message accepted with clientOpId", r.status === 201 && !!r.data?.message?.id, `got ${r.status}`);
const firstMsgId = r.data?.message?.id;
r = await req("POST", "/messages", { cookie: teacherCookie, body: { recipientId: adviserId, ciphertext: "C3", iv: "IV3", wrappedKey: "WK3", clientOpId: "clientop-1" } });
check("message replay with same clientOpId returns same id", r.status === 200 && String(r.data?.message?.id) === String(firstMsgId), `got ${r.status} ${JSON.stringify(r.data)}`);
r = await req("GET", `/messages/${adviserId}`, { cookie: teacherCookie });
check("thread has no duplicate from replay", (r.data?.messages || []).filter((m) => m.ciphertext === "C3").length === 1, JSON.stringify((r.data?.messages || []).map((m) => m.ciphertext)));

// 13. adviser acting as subject teacher for another section
const adv2 = {
  ...adviser, email: "adviser-b@school.edu.ph", section: "2", firstName: "Pedro", lastName: "Lim",
  teachingLoad: [{ grade: "11", strand: "STEM", section: "1", academicYear: "2025-2026", subject: "General Physics", semester: "1st Semester, 1st Quarter" }],
};
r = await schoolSignup(schoolA, adv2);
check("second adviser (Block 2) signup", r.status === 201);
const adv2Cookie = r.cookie;

// 13a. non-owner cannot unpublish adviser1's published sheet
r = await req("POST", `/grades/${sheet.sheetId}/unpublish`, { cookie: adv2Cookie });
check("non-owner unpublish blocked 403", r.status === 403, `got ${r.status}`);

const fd3 = new FormData();
fd3.append("file", new Blob([downloaded], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fd3.append("subject", "General Physics");
fd3.append("semester", "1st Semester, 1st Quarter");
fd3.append("academicYear", "2025-2026");
r = await req("POST", "/grades/upload", { cookie: adv2Cookie, form: fd3 });
check("adviser-as-teacher upload for adviser1 advisory", r.status === 201 && r.data.matched === 4, `matched=${r.data?.matched} ${r.data?.error || ""}`);

// 13b. teacher can pick ANY class (no longer restricted to own grade/strand/section)
const adv3 = { ...adviser, email: "adviser-c@school.edu.ph", section: "3", firstName: "Luz", lastName: "Magsaysay" };
r = await schoolSignup(schoolA, adv3);
check("third adviser (Block 3) signup", r.status === 201, `got ${r.status}`);
const adv3Cookie = r.cookie;
const stemCStudents = [
  { firstName: "Rico", middleName: "", lastName: "Aguilar", gender: "Male", email: "rico@student.edu.ph" },
  { firstName: "May", middleName: "", lastName: "Salazar", gender: "Female", email: "may@student.edu.ph" },
];
for (const s of stemCStudents) {
  r = await schoolSignup(schoolA, { ...s, role: "student", grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", password: "secret123" });
  check(`student signup ${s.email.split("@")[0]} 201`, r.status === 201, `got ${r.status}`);
}
r = await req("GET", "/grades/sections?grade=11&strand=STEM&ay=2025-2026", { cookie: teacherCookie });
check("teacher sees all sections incl Block 3", r.data?.sections?.some((s) => s.section === "3"), JSON.stringify(r.data?.sections?.map((s) => s.section)));
r = await req("GET", "/grades/format?grade=11&strand=STEM&section=3&ay=2025-2026&subject=General Mathematics", { cookie: teacherCookie });
check("teacher downloads format for another section", r.status === 200 && r.data.byteLength > 0, `got ${r.status}`);
const downloadedC = Buffer.from(r.data);
const parsedC = await parseSubmission(downloadedC);
const gradedC = await buildTemplate({
  gradeLevel: parsedC.gradeLevel, strand: parsedC.strand, section: parsedC.section, academicYear: parsedC.academicYear,
  adviserName: parsedC.adviserName, school: parsedC.school,
  students: stemCStudents.map((s, i) => ({ ...s, gradeValue: 88 + i })),
});
const fdC = new FormData();
fdC.append("file", new Blob([gradedC.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fdC.append("subject", "General Mathematics");
fdC.append("semester", "1st Semester, 1st Quarter");
fdC.append("academicYear", "2025-2026");
fdC.append("grade", "11");
fdC.append("strand", "STEM");
fdC.append("section", "3");
r = await req("POST", "/grades/upload", { cookie: teacherCookie, form: fdC });
check("teacher uploads for another section", r.status === 201 && r.data.matched === 2, `matched=${r.data?.matched} ${r.data?.error || ""}`);
r = await req("GET", "/grades/adviser", { cookie: adv3Cookie });
check("grades routed to the matching Block 3 adviser", JSON.stringify(r.data?.tree).includes("General Mathematics") && JSON.stringify(r.data?.tree).includes("Jose Reyes"), JSON.stringify(r.data?.tree)?.slice(0, 160));

// 13c. selected class must match the file metadata
const fdBad = new FormData();
fdBad.append("file", new Blob([graded.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fdBad.append("subject", "General Mathematics");
fdBad.append("semester", "1st Semester, 1st Quarter");
fdBad.append("academicYear", "2025-2026");
fdBad.append("grade", "11");
fdBad.append("strand", "STEM");
fdBad.append("section", "3");
r = await req("POST", "/grades/upload", { cookie: teacherCookie, form: fdBad });
check("mismatched selection vs file rejected 400", r.status === 400, r.data?.error);

// ---- 13d. online encoding with automatic computation (Block 3) ----
// the teacher adds an explicit teaching assignment so the strict encode check passes
r = await req("POST", "/users/me/classes", {
  cookie: teacherCookie,
  body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter" },
});
check("teacher adds Earth and Life Science teaching assignment", r.status === 201, r.data?.error);

r = await req("GET", "/grades/roster?grade=11&strand=STEM&section=3&ay=2025-2026", { cookie: teacherCookie });
check("roster lists Block 3 students", r.data?.students?.length === 2, JSON.stringify(r.data?.students?.length));
check("roster includes adviser name", r.data?.adviser?.name === fullName({ firstName: "Luz", middleName: "R", lastName: "Magsaysay" }), r.data?.adviser?.name);
const rico = r.data.students.find((s) => s.lastName === "Aguilar");
const may = r.data.students.find((s) => s.lastName === "Salazar");
r = await req("GET", "/grades/roster?ay=2025-2026", { cookie: teacherCookie });
check("roster without section rejected 400", r.status === 400, r.data?.error);

r = await req("POST", "/grades/encode", {
  cookie: teacherCookie,
  body: {
    grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026",
    subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter",
    scores: [
      { studentId: rico.id, ww: "90", pt: "85", qa: "88" },
      { studentId: may.id, ww: "80", pt: "75", qa: "80" },
    ],
  },
});
check("teacher encodes scores online", r.status === 201 && r.data.computed === 2 && r.data.incomplete === 0, `${r.status} ${JSON.stringify(r.data)}`);

r = await req("POST", "/grades/encode", {
  cookie: teacherCookie,
  body: {
    grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026",
    subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter",
    scores: [{ studentId: rico.id, ww: "90", pt: "85", qa: "88" }],
  },
});
check("duplicate encode rejected 409", r.status === 409, r.data?.error);

r = await req("POST", "/grades/encode", {
  cookie: teacherCookie,
  body: {
    grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026",
    subject: "Personal Development", semester: "1st Semester, 1st Quarter",
    scores: [{ studentId: rico.id, ww: "90", pt: "85", qa: "" }],
  },
});
check("encode with missing components rejected 400", r.status === 400, r.data?.error);

r = await req("POST", "/grades/encode", {
  cookie: teacherCookie,
  body: {
    grade: "13", strand: "STEM", section: "3", academicYear: "2025-2026",
    subject: "General Mathematics", semester: "1st Semester, 1st Quarter",
    scores: [{ studentId: rico.id, ww: "90", pt: "85", qa: "88" }],
  },
});
check("encode with invalid grade level refused 400", r.status === 400 && /refused/i.test(r.data?.error), r.data?.error);

const anaId = studentIds["ana@student.edu.ph"];
r = await req("POST", "/grades/encode", {
  cookie: adv3Cookie,
  body: {
    grade: "11", strand: "STEM", section: "1", academicYear: "2025-2026",
    subject: "General Mathematics", semester: "1st Semester, 1st Quarter",
    scores: [{ studentId: anaId, ww: "80", pt: "80", qa: "80" }],
  },
});
check("adviser cannot encode outside own advisory/teaching load 403", r.status === 403, r.data?.error);

r = await req("GET", "/grades/adviser", { cookie: adv3Cookie });
const elsSheet = (r.data?.tree?.flatMap((ay) => ay.semesters)?.flatMap((s) => s.strands)?.flatMap((st) => st.sheets) || []).find((s) => s.subject === "Earth and Life Science");
check("encoded sheet lands in adviser dashboard", !!elsSheet, JSON.stringify(r.data?.tree)?.slice(0, 160));
const ricoEntry = elsSheet?.entries?.find((e) => String(e.studentId) === String(rico.id));
const mayEntry = elsSheet?.entries?.find((e) => String(e.studentId) === String(may.id));
check("Rico transmuted to 91 (weighted 87.1)", ricoEntry?.grade === 91, `grade=${ricoEntry?.grade}`);
check("May transmuted to 85 (weighted 77.5)", mayEntry?.grade === 85, `grade=${mayEntry?.grade}`);

// ---- 13e. report cards ----
r = await req("GET", "/grades/report-cards?semester=1st Semester, 1st Quarter&ay=2025-2026", { cookie: adv3Cookie });
check("adviser downloads report cards xlsx", r.status === 200 && r.data.byteLength > 0, `${r.data.byteLength} bytes`);
check("report cards filename", (r.headers["content-disposition"] || "").includes("Report_Cards"), r.headers["content-disposition"]);
r = await req("GET", "/grades/report-cards?semester=2nd Semester, 1st Quarter&ay=2025-2026", { cookie: adv3Cookie });
check("report cards with no submissions rejected 400", r.status === 400, r.data?.error);
r = await req("GET", "/grades/report-cards?semester=1st Semester, 1st Quarter", { cookie: teacherCookie });
check("non-adviser report cards blocked 403", r.status === 403, `got ${r.status}`);

r = await login("/auth/login", { email: "rico@student.edu.ph", password: "secret123" });
const ricoCookie = r.cookie;
r = await req("GET", "/grades/student/report-card", { cookie: ricoCookie });
check("student report card with no published grades rejected 400", r.status === 400, r.data?.error);

r = await req("POST", `/grades/${elsSheet.sheetId}/publish`, { cookie: adv3Cookie });
check("adviser publishes encoded sheet", r.status === 200, r.data?.message);

r = await req("GET", "/grades/student/report-card", { cookie: ricoCookie });
check("student downloads own report card xlsx", r.status === 200 && r.data.byteLength > 0, `${r.data.byteLength} bytes`);
check("student report card filename", (r.headers["content-disposition"] || "").includes("Report_Card_Aguilar_Rico.xlsx"), r.headers["content-disposition"]);
r = await req("GET", "/grades/report-cards?semester=1st Semester, 1st Quarter", { cookie: ricoCookie });
check("student blocked from adviser report cards 403", r.status === 403, `got ${r.status}`);

// ---- 13f. adviser is also a subject teacher across grades/strands ----
const adviserX = {
  role: "adviser", firstName: "Ariel", middleName: "", lastName: "Dela Peña", email: "adviser-x@school.edu.ph", password: "secret123",
  grade: "11", strand: "STEM", section: "5", academicYear: "2025-2026",
  teachingLoad: [{ grade: "12", strand: "STEM", section: "5", academicYear: "2025-2026", subject: "General Physics", semester: "1st Semester, 1st Quarter" }],
};
r = await schoolSignup(schoolA, adviserX);
check("adviser signs up with a cross-grade teaching load", r.status === 201 && r.data?.user?.teachingLoad?.length === 1, `${r.status} ${JSON.stringify(r.data?.user?.teachingLoad)}`);
const adviserXCookie = r.cookie;

r = await schoolSignup(schoolA, { ...adviserX, email: "adviser-x2@school.edu.ph", firstName: "Jan", teachingLoad: [{ grade: "12", strand: "STEM", section: "5", academicYear: "2025-2026", subject: "Mathematics", semester: "1st Semester, 1st Quarter" }] });
check("signup rejects invalid subject for teaching load grade", r.status === 400, r.data?.error);

const adviserY = {
  role: "adviser", firstName: "Diana", middleName: "", lastName: "Mata", email: "adviser-y@school.edu.ph", password: "secret123",
  grade: "12", strand: "STEM", section: "5", academicYear: "2025-2026",
};
r = await schoolSignup(schoolA, adviserY);
check("adviser for Grade 12 STEM Block 5 signup", r.status === 201, `got ${r.status}`);
const adviserYCookie = r.cookie;

const crossStudents = [
  { firstName: "Nilo", middleName: "", lastName: "Abad", gender: "Male", email: "nilo@student.edu.ph" },
  { firstName: "Dara", middleName: "", lastName: "Belen", gender: "Female", email: "dara@student.edu.ph" },
];
for (const s of crossStudents) {
  r = await schoolSignup(schoolA, { ...s, role: "student", grade: "12", strand: "STEM", section: "5", academicYear: "2025-2026", password: "secret123" });
  check(`G12 student signup ${s.email.split("@")[0]} 201`, r.status === 201, `got ${r.status}`);
}
const ownStudents = [
  { firstName: "Omar", middleName: "", lastName: "Cayetano", gender: "Male", email: "omar@student.edu.ph" },
  { firstName: "Pia", middleName: "", lastName: "Dimagiba", gender: "Female", email: "pia@student.edu.ph" },
];
for (const s of ownStudents) {
  r = await schoolSignup(schoolA, { ...s, role: "student", grade: "11", strand: "STEM", section: "5", academicYear: "2025-2026", password: "secret123" });
  check(`G11 student signup ${s.email.split("@")[0]} 201`, r.status === 201, `got ${r.status}`);
}

r = await req("GET", "/grades/roster?grade=12&strand=STEM&section=5&ay=2025-2026", { cookie: adviserXCookie });
check("adviser-teacher loads another strand's roster", r.data?.students?.length === 2 && r.data?.adviser?.name === fullName({ firstName: "Diana", middleName: "", lastName: "Mata" }), JSON.stringify(r.data?.students?.length));

const rosterX = r.data;
r = await req("POST", "/grades/encode", {
  cookie: adviserXCookie,
  body: {
    grade: "12", strand: "STEM", section: "5", academicYear: "2025-2026",
    subject: "General Physics", semester: "1st Semester, 1st Quarter",
    scores: rosterX.students.map((s) => ({ studentId: s.id, ww: "85", pt: "80", qa: "82" })),
  },
});
check("adviser encodes grades for a different grade/strand", r.status === 201 && r.data.computed === 2, `${r.status} ${r.data?.error || ""}`);
r = await req("GET", "/grades/adviser", { cookie: adviserYCookie });
check("grades routed to the other class's adviser", JSON.stringify(r.data?.tree).includes("General Physics") && JSON.stringify(r.data?.tree).includes("Dela Peña"), JSON.stringify(r.data?.tree)?.slice(0, 160));

r = await req("GET", "/grades/roster?grade=11&strand=STEM&section=5&ay=2025-2026", { cookie: adviserXCookie });
const ownRoster = r.data.students;
r = await req("POST", "/grades/encode", {
  cookie: adviserXCookie,
  body: {
    grade: "11", strand: "STEM", section: "5", academicYear: "2025-2026",
    subject: "General Mathematics", semester: "1st Semester, 1st Quarter",
    scores: ownRoster.map((s) => ({ studentId: s.id, ww: "78", pt: "82", qa: "80" })),
  },
});
check("adviser encodes grades for own advisory", r.status === 201 && r.data.computed === 2, `${r.status} ${r.data?.error || ""}`);
r = await req("GET", "/grades/adviser", { cookie: adviserXCookie });
check("own-advisory sheet appears on own dashboard", JSON.stringify(r.data?.tree).includes("General Mathematics"), JSON.stringify(r.data?.tree)?.slice(0, 160));

// teaching load management
r = await req("GET", "/users/me/classes", { cookie: adviserXCookie });
check("me/classes lists 1 advisory + 1 teaching assignment", r.data?.advisories?.length === 1 && r.data?.teachingLoad?.length === 1, JSON.stringify({ a: r.data?.advisories?.length, t: r.data?.teachingLoad?.length }));
r = await req("POST", "/users/me/classes", {
  cookie: adviserXCookie,
  body: { grade: "11", strand: "ABM", section: "5", academicYear: "2025-2026", subject: "General Mathematics", semester: "1st Semester, 1st Quarter" },
});
check("adviser adds a teaching assignment via API", r.status === 201, r.data?.error);
r = await req("POST", "/users/me/classes", {
  cookie: adviserXCookie,
  body: { grade: "11", strand: "ABM", section: "5", academicYear: "2025-2026", subject: "General Mathematics", semester: "1st Semester, 1st Quarter" },
});
check("duplicate teaching assignment rejected 409", r.status === 409, r.data?.error);
r = await req("POST", "/users/me/classes", {
  cookie: adviserXCookie,
  body: { grade: "11", strand: "ABM", section: "5", academicYear: "2025-2026", subject: "Mathematics", semester: "1st Semester, 1st Quarter" },
});
check("teaching assignment with wrong-grade subject rejected 400", r.status === 400, r.data?.error);
r = await req("GET", "/users/me/classes", { cookie: adviserXCookie });
const extraAssignment = r.data.teachingLoad.find((a) => a.strand === "ABM");
check("me/classes shows the added ABM assignment", !!extraAssignment, JSON.stringify(r.data?.teachingLoad));
r = await req("DELETE", `/users/me/classes/${extraAssignment.id}`, { cookie: adviserXCookie });
check("adviser removes a teaching assignment", r.status === 200, r.data?.error);

// multiple advisories
r = await req("POST", "/users/me/advisories", {
  cookie: adviserXCookie,
  body: { grade: "12", strand: "HUMSS", section: "5", academicYear: "2025-2026" },
});
check("adviser adds a second advisory", r.status === 201, r.data?.error);
r = await req("GET", "/users/me/classes", { cookie: adviserXCookie });
check("me/classes lists both advisories", r.data?.advisories?.length === 2, JSON.stringify(r.data?.advisories));
const secondAdvisory = r.data.advisories.find((a) => a.strand === "HUMSS");
const primaryAdvisory = r.data.advisories.find((a) => a.primary);
r = await req("POST", "/users/me/advisories", {
  cookie: adviserXCookie,
  body: { grade: "12", strand: "HUMSS", section: "5", academicYear: "2025-2026" },
});
check("duplicate advisory rejected 409", r.status === 409, r.data?.error);
r = await req("DELETE", `/users/me/advisories/${primaryAdvisory.id}`, { cookie: adviserXCookie });
check("primary advisory cannot be removed 400", r.status === 400, r.data?.error);
r = await req("DELETE", `/users/me/advisories/${secondAdvisory.id}`, { cookie: adviserXCookie });
check("second advisory can be removed", r.status === 200, r.data?.error);

r = await req("GET", "/grades/report-cards?semester=1st Semester, 1st Quarter&ay=2025-2026&grade=11&strand=STEM&section=5", { cookie: adviserXCookie });
check("per-advisory report cards download", r.status === 200 && r.data.byteLength > 0, `${r.data.byteLength} bytes`);

// ---- 13g. assessment components: combined WW/PT/QA totals + QA quarter selection ----
// the teacher (Earth and Life Science, Block 3) adds WW/PT/QA components with NO scores yet
const compDefs = [
  { type: "ww", label: "Quiz 1", item: 20 },
  { type: "ww", label: "Quiz 2", item: 30 },
  { type: "pt", label: "Performance Task 1", item: 40 },
  { type: "qa", label: "Quarterly Exam Q1", item: 50 },
];
const comps = {};
for (const c of compDefs) {
  r = await req("POST", "/assessments", {
    cookie: teacherCookie,
    body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", ...c },
  });
  check(`assessment component ${c.type}:${c.label} created`, r.status === 201 && !!r.data?.assessment?._id, `${r.status} ${r.data?.error || ""}`);
  comps[`${c.type}:${c.label}`] = r.data.assessment;
}

// client-generated _id makes offline-created components idempotent on sync replay
const clientCompId = "aaaaaaaaaaaaaaaaaaaa0000";
r = await req("POST", "/assessments", {
  cookie: teacherCookie,
  body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", type: "ww", label: "Sync Quiz", item: 15, _id: clientCompId },
});
check("assessment accepted with client _id", r.status === 201 && String(r.data?.assessment?._id) === clientCompId, `${r.status} ${r.data?.error || ""}`);
r = await req("POST", "/assessments", {
  cookie: teacherCookie,
  body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", type: "ww", label: "Sync Quiz", item: 15, _id: clientCompId },
});
check("assessment replay with same client _id is idempotent 200", r.status === 200 && String(r.data?.assessment?._id) === clientCompId, `${r.status} ${r.data?.error || ""}`);

// component delete is idempotent too (sync replay after a lost response)
r = await req("DELETE", `/assessments/${clientCompId}`, { cookie: teacherCookie });
check("component delete with client id", r.status === 200, r.data?.error);
r = await req("DELETE", `/assessments/${clientCompId}`, { cookie: teacherCookie });
check("component delete replay idempotent 200", r.status === 200, `${r.status}`);

r = await req("GET", "/assessments/summary", {
  cookie: teacherCookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", scope: "mine" },
});
check("summary combines items of unscored WW/PT/QA", r.status === 200 && r.data?.totals?.wwItems === 50 && r.data?.totals?.ptItems === 40 && r.data?.totals?.qaItems === 50, JSON.stringify(r.data?.totals));
check("summary component counts", r.data?.components?.ww === 2 && r.data?.components?.pt === 1 && r.data?.components?.qa === 1, JSON.stringify(r.data?.components));
const unscoredRow = r.data?.students?.find((s) => String(s.id) === String(rico.id));
check("unscored student shows combined items but blank score", !!unscoredRow && unscoredRow.wwItems === 50 && unscoredRow.ptItems === 40 && unscoredRow.qaItems === 50 && unscoredRow.ww === null, JSON.stringify(unscoredRow));

// score one component — combined scores + items update immediately
r = await req("PUT", `/assessments/${comps["ww:Quiz 1"]._id}`, {
  cookie: teacherCookie,
  body: { label: "Quiz 1", item: 20, scores: [{ studentId: rico.id, score: 18, item: null }, { studentId: may.id, score: 16, item: null }] },
});
check("component scores saved", r.status === 200, r.data?.error);

r = await req("GET", "/assessments/summary", {
  cookie: teacherCookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", scope: "mine" },
});
const scoredRow = r.data?.students?.find((s) => String(s.id) === String(rico.id));
check("combined student score sums entered scores", !!scoredRow && scoredRow.ww === 18 && scoredRow.wwItems === 50, JSON.stringify(scoredRow));
check("class combined scores update", r.data?.totals?.ww === 34 && r.data?.totals?.wwItems === 50, JSON.stringify(r.data?.totals));

// adviser advisory view (scope=all) reflects the teacher's components
r = await req("GET", "/assessments/summary", {
  cookie: adv3Cookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", scope: "all" },
});
check("adviser advisory view sees combined totals", r.status === 200 && r.data?.totals?.wwItems === 50 && r.data?.totals?.ptItems === 40 && r.data?.totals?.qaItems === 50, JSON.stringify(r.data?.totals));

// QA with an explicit different quarter than the assignment's own quarter
r = await req("POST", "/assessments", {
  cookie: teacherCookie,
  body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "2nd Semester, 3rd Quarter", type: "qa", label: "Quarterly Exam Q3", item: 60 },
});
check("QA created for a different quarter than the assignment", r.status === 201 && r.data?.assessment?.semester === "2nd Semester, 3rd Quarter", `${r.status} ${r.data?.error || ""}`);

r = await req("GET", "/assessments", { cookie: teacherCookie, query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", subject: "Earth and Life Science" } });
check("components fetch spans all quarters", r.status === 200 && new Set((r.data?.assessments || []).map((a) => a.semester)).size === 2, JSON.stringify([...new Set((r.data?.assessments || []).map((a) => a.semester))]));

r = await req("GET", "/assessments/summary", {
  cookie: teacherCookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", subject: "Earth and Life Science", semester: "2nd Semester, 3rd Quarter", scope: "mine" },
});
check("summary for the QA's quarter isolates it", r.status === 200 && r.data?.totals?.qaItems === 60 && r.data?.totals?.wwItems === 0 && r.data?.totals?.ptItems === 0, JSON.stringify(r.data?.totals));

// unassigned account cannot add components
r = await req("POST", "/assessments", {
  cookie: adv2Cookie,
  body: { grade: "11", strand: "STEM", section: "3", academicYear: "2025-2026", subject: "Earth and Life Science", semester: "1st Semester, 1st Quarter", type: "ww", label: "Blocked", item: 10 },
});
check("unassigned account cannot add a component 403", r.status === 403, r.data?.error);

// 13h. Class Tally subjects list includes teaching assignments even before any component is recorded
// (scope=mine for an adviser's own cross-grade teaching assignment that has no components yet)
r = await req("GET", "/assessments/subjects", {
  cookie: adviserXCookie,
  query: { grade: "12", strand: "STEM", section: "5", ay: "2025-2026", semester: "1st Semester, 1st Quarter", scope: "mine" },
});
const xSubjects = r.data?.subjects || [];
check("subjects (scope=mine) lists adviser's assignment subject without components", r.status === 200 && xSubjects.some((s) => s.subject === "General Physics"), JSON.stringify(xSubjects));
check("subjects (scope=mine) flags the assignment-based subject", xSubjects.find((s) => s.subject === "General Physics")?.fromAssignment === true, JSON.stringify(xSubjects));

// a quarter with neither an assignment nor components stays an empty 200 list
r = await req("GET", "/assessments/subjects", {
  cookie: adviserXCookie,
  query: { grade: "12", strand: "STEM", section: "5", ay: "2025-2026", semester: "2nd Semester, 4th Quarter", scope: "mine" },
});
check("subjects (scope=mine) empty 200 for a quarter with no assignment", r.status === 200 && (r.data?.subjects || []).length === 0, JSON.stringify(r.data?.subjects));

// scope=mine on the teacher's own class lists their recorded components too
r = await req("GET", "/assessments/subjects", {
  cookie: teacherCookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", semester: "1st Semester, 1st Quarter", scope: "mine" },
});
const tSubjects = r.data?.subjects?.find((s) => s.subject === "Earth and Life Science");
check("subjects (scope=mine) merges component counts onto the assignment subject", r.status === 200 && tSubjects?.components?.ww === 2 && tSubjects?.components?.pt === 1 && tSubjects?.components?.qa === 1, JSON.stringify(tSubjects));

// adviser advisory view (scope=all) lists every subject taught for the class+quarter
r = await req("GET", "/assessments/subjects", {
  cookie: adv3Cookie,
  query: { grade: "11", strand: "STEM", section: "3", ay: "2025-2026", semester: "1st Semester, 1st Quarter", scope: "all" },
});
check("subjects (scope=all) lists the class's teaching assignments", r.status === 200 && (r.data?.subjects || []).some((s) => s.subject === "Earth and Life Science"), JSON.stringify(r.data?.subjects));

// 14. adviser cannot message students
r = await req("POST", "/messages", { cookie: adviserCookie, body: { recipientId: studentIds[students[0].email], ciphertext: "X", iv: "X", wrappedKey: "X" } });
check("adviser blocked from messaging student 403", r.status === 403, `got ${r.status}`);

// ---- 15. cross-school disambiguation ----
const adviserB = { ...adviser, email: "adviser-b2@school.edu.ph", firstName: "Nena", lastName: "Gonzales" };
r = await schoolSignup(schoolB, adviserB);
check("same advisory adviser allowed in school B (diff province)", r.status === 201, `got ${r.status} ${r.data?.error || ""}`);
const adviserBCookie = r.cookie;
const teacherB = { ...teacher, email: "teacher-b@school.edu.ph", firstName: "Ramon", lastName: "Aquino" };
r = await schoolSignup(schoolB, teacherB);
check("teacher B signup", r.status === 201, `got ${r.status}`);
const teacherBCookie = r.cookie;
const studentsB = [
  { firstName: "Liza", middleName: "", lastName: "Santos", gender: "Female", email: "liza@student.edu.ph" },
  { firstName: "Mark", middleName: "", lastName: "Villanueva", gender: "Male", email: "mark@student.edu.ph" },
];
for (const s of studentsB) {
  r = await schoolSignup(schoolB, { ...s, role: "student", grade: "11", strand: "STEM", section: "1", academicYear: "2025-2026", password: "secret123" });
  check(`school B student signup ${s.email.split("@")[0]} 201`, r.status === 201, `got ${r.status}`);
}
const adviserC = { ...adviser, email: "adviser-c2@school.edu.ph", firstName: "Irene", lastName: "Dizon" };
r = await schoolSignup(schoolC, adviserC);
check("same advisory adviser allowed in school C (diff barangay)", r.status === 201, `got ${r.status} ${r.data?.error || ""}`);

r = await req("GET", "/grades/sections?grade=11&strand=STEM&ay=2025-2026", { cookie: teacherBCookie });
check("teacher B sees only school B advisers", r.data?.sections?.length === 1 && r.data?.sections?.[0]?.adviser?.name === fullName({ firstName: "Nena", middleName: "R", lastName: "Gonzales" }), JSON.stringify(r.data?.sections));

r = await req("GET", "/grades/format?grade=11&strand=STEM&section=1&ay=2025-2026&subject=General Mathematics", { cookie: teacherBCookie });
check("teacher B downloads school B format", r.status === 200 && r.data.byteLength > 0, `got ${r.status}`);
const downloadedB = Buffer.from(r.data);
check("school B file header shows Bulacan address", (await sheetText(downloadedB)).includes("STI College of Bulacan, City of Malolos, San Fernando"), await sheetText(downloadedB));
const parsedB = await parseSubmission(downloadedB);
const gradedB = await buildTemplate({
  gradeLevel: parsedB.gradeLevel, strand: parsedB.strand, section: parsedB.section, academicYear: parsedB.academicYear,
  adviserName: parsedB.adviserName, school: parsedB.school,
  students: studentsB.map((s, i) => ({ ...s, gradeValue: 90 + i })),
});
const fdB = new FormData();
fdB.append("file", new Blob([gradedB.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "grades.xlsx");
fdB.append("subject", "General Mathematics");
fdB.append("semester", "1st Semester, 1st Quarter");
fdB.append("academicYear", "2025-2026");
fdB.append("grade", "11");
fdB.append("strand", "STEM");
fdB.append("section", "1");
r = await req("POST", "/grades/upload", { cookie: teacherBCookie, form: fdB });
check("school B upload routes to school B adviser", r.status === 201 && r.data.matched === 2, `matched=${r.data?.matched} ${r.data?.error || ""}`);

r = await req("GET", "/grades/adviser", { cookie: adviserBCookie });
check("school B adviser received the grades", JSON.stringify(r.data?.tree).includes("Ramon Aquino"), JSON.stringify(r.data?.tree)?.slice(0, 160));
r = await req("GET", "/grades/adviser", { cookie: adviserCookie });
check("school A adviser did NOT receive school B grades", !JSON.stringify(r.data?.tree).includes("Ramon Aquino"), JSON.stringify(r.data?.tree)?.slice(0, 160));

r = await req("GET", "/messages/contacts", { cookie: teacherBCookie });
check("teacher B contacts only school B adviser", r.data?.contacts?.length === 1 && r.data?.contacts?.[0]?.fullName === "Nena R Gonzales", JSON.stringify(r.data?.contacts));
r = await req("POST", "/messages", { cookie: teacherBCookie, body: { recipientId: adviserId, ciphertext: "C", iv: "I", wrappedKey: "W" } });
check("cross-school message blocked 403", r.status === 403, `got ${r.status}`);

// ---- 16. legacy account without keys gets keypair backfilled on login ----
await mongoose.connect(MONGO_URI);
const bcrypt = (await import("bcryptjs")).default;
const legacy = await User.create({
  role: "adviser", email: "legacy@school.edu.ph", password: await bcrypt.hash("secret123", 10),
  firstName: "Old", lastName: "Account", grade: "11", strand: "STEM", section: "2", academicYear: "2025-2026",
  schoolId: new mongoose.Types.ObjectId(schoolCId),
  school: { id: schoolCId, name: schoolC.name, province: schoolC.province, city: schoolC.city, barangay: schoolC.barangay },
  publicKey: "", privateKey: "",
});
await mongoose.disconnect();
r = await login("/auth/login", { email: "legacy@school.edu.ph", password: "secret123" });
check("legacy login 200", r.status === 200, `got ${r.status}`);
check("legacy account gets backfilled keys on login", !!r.data?.user?.publicKey && !!r.data?.user?.privateKey, `pub=${r.data?.user?.publicKey?.length} priv=${r.data?.user?.privateKey?.length}`);
check("legacy backfilled keypair works", await hybridRoundTrip(r.data?.user?.publicKey, r.data?.user?.privateKey, "legacy"), "");

// clean up the legacy account so it doesn't pollute the seeded demo DB
await mongoose.connect(MONGO_URI);
await User.deleteOne({ _id: legacy._id });
await mongoose.disconnect();

// ---- 17. forgot password / reset flow ----
r = await req("POST", "/auth/forgot-password", { body: { email: adviser.email } });
check("forgot-password returns ok + masked email", r.status === 200 && r.data?.ok && (r.data?.maskedEmail || "").includes("***"), JSON.stringify(r.data));
const resetCode = r.data?.devCode;
check("dev mode returns 6-digit reset code", typeof resetCode === "string" && resetCode.length === 6, `code=${resetCode}`);

r = await req("POST", "/auth/forgot-password", { body: { email: "nobody@nowhere.com" } });
check("forgot-password unknown email still ok, no code", r.status === 200 && r.data?.ok && !r.data?.devCode, JSON.stringify(r.data));

r = await req("POST", "/auth/reset-password", { body: { email: adviser.email, code: "000000", password: "newsecret456" } });
check("reset with wrong code rejected 400", r.status === 400, r.data?.error);

r = await req("POST", "/auth/reset-password", { body: { email: adviser.email, code: resetCode, password: "newsecret456" } });
check("reset with valid code ok", r.status === 200 && r.data?.ok, JSON.stringify(r.data));

r = await login("/auth/login", { email: adviser.email, password: "secret123" });
check("old password rejected after reset 401", r.status === 401, `got ${r.status}`);

r = await login("/auth/login", { email: adviser.email, password: "newsecret456" });
check("new password login ok from same IP", r.status === 200 && !!r.data?.user, `got ${r.status} ${r.data?.error || ""}`);

// ---- 18. first-IP capture + new-IP login verification ----
await mongoose.connect(MONGO_URI);
const signupIp = (await User.findById(adviserId))?.verifiedIps?.[0];
await mongoose.disconnect();
check("signup recorded the first IP in db", !!signupIp, `ip=${signupIp}`);

const foreignIp = "203.0.113.10";
  r = await login("/auth/login", { email: adviser.email, password: "newsecret456" }, "adviser-device-1", { "x-forwarded-for": foreignIp });
  check("login from a different IP triggers verification", r.status === 200 && r.data?.needsVerification === true, JSON.stringify(r.data));
  const loginCode = r.data?.devCode;
  check("dev mode returns 6-digit login code", typeof loginCode === "string" && loginCode.length === 6, `code=${loginCode}`);
  check("masked email hides the address", (r.data?.maskedEmail || "") !== adviser.email && (r.data?.maskedEmail || "").includes("***"), r.data?.maskedEmail);
  check("no session token issued while unverified", !r.cookie.includes("token"), `cookie=${r.cookie}`);

  r = await login("/auth/login/verify", { email: adviser.email, code: "000000" }, "adviser-device-1", { "x-forwarded-for": foreignIp });
  check("verify-login with wrong code rejected 400", r.status === 400, r.data?.error);

  r = await login("/auth/login/verify", { email: adviser.email, code: loginCode }, "adviser-device-1", { "x-forwarded-for": foreignIp });
check("verify-login with correct code logs in", r.status === 200 && !!r.data?.user, `got ${r.status} ${r.data?.error || ""}`);
const verifiedCookie = r.cookie;

r = await req("GET", "/auth/me", { cookie: verifiedCookie });
check("verified session works", r.status === 200 && r.data?.user?.email === adviser.email, `got ${r.status}`);

await mongoose.connect(MONGO_URI);
const dbUser2 = await User.findById(adviserId);
const persistedForeign = (dbUser2.verifiedIps || []).includes(foreignIp);
await mongoose.disconnect();
check("new IP persisted after verification", persistedForeign, JSON.stringify(dbUser2.verifiedIps));

  r = await login("/auth/login", { email: adviser.email, password: "newsecret456" }, "adviser-device-1", { "x-forwarded-for": foreignIp });
check("known IP login no longer requires verification", r.status === 200 && !r.data?.needsVerification, JSON.stringify(r.data));

const failed = results.filter(([n, c]) => !c);
log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
