import nodemailer from "nodemailer";
import { env } from "../config/index.js";

let transporter = null;

function getTransporter() {
  const { smtp } = env;
  if (!smtp.host || !smtp.user) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }
  return transporter;
}

export function smtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.user);
}

async function send({ to, subject, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[mailer] SMTP not configured - email skipped -> ${to} | ${subject}`);
    return { skipped: true };
  }
  try {
    const info = await transport.sendMail({ from: env.smtp.from, to, subject, html });
    console.log(`[mailer] sent -> ${to} | ${subject} | ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    return { error: err.message };
  }
}

const ROLE_LABELS = { adviser: "Adviser", teacher: "Subject Teacher", student: "Student" };

function roleDetails({ role, grade, strand, tvlStrand, specialization, section, subject, semester, academicYear, school }) {
  const strandTxt = strand ? ` - ${strand}` : "";
  const tvlTxt = tvlStrand ? ` (${tvlStrand})` : "";
  const specTxt = specialization ? ` - ${specialization}` : "";
  const gradeTxt = grade ? `Grade ${grade}${strandTxt}${tvlTxt}${specTxt}` : "";
  const classTxt = section ? `${gradeTxt} - ${section}` : gradeTxt;
  const schoolTxt = typeof school === "object" && school ? school.name || school : school || "";
  if (role === "student") {
    return {
      heading: "Your student account is ready",
      lines: [
        ["Class", classTxt],
        ["Academic year", academicYear],
        ["School", schoolTxt],
      ],
    };
  }
  if (role === "adviser") {
    return {
      heading: "Your adviser account is ready",
      lines: [
        ["Adviser for", classTxt],
        ["Academic year", academicYear],
        ["School", schoolTxt],
      ],
    };
  }
  if (role === "teacher") {
    return {
      heading: "Your subject teacher account is ready",
      lines: [
        ["Subject", subject],
        ["Class", classTxt],
        ["Semester", semester],
        ["Academic year", academicYear],
        ["School", schoolTxt],
      ],
    };
  }
  return { heading: "Your account is ready", lines: [] };
}

export async function sendAccountCreated(to, info) {
  const { firstName, role, email } = info;
  const roleLabel = ROLE_LABELS[role] || "Account";
  const { heading, lines } = roleDetails(info);
  const rows = lines
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><strong>${k}</strong></td><td>${v}</td></tr>`)
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0f766e">Welcome to Sysnnova</h2>
      <p>Hello ${firstName},</p>
      <p>Your account as a <strong>${roleLabel}</strong> has been created successfully.</p>
      <p><strong>${heading}</strong></p>
      ${rows ? `<table style="border-collapse:collapse;margin:12px 0">${rows}</table>` : ""}
      <p>You can now sign in using:<br/>Email: <strong>${email}</strong></p>
      <p style="color:#666;font-size:13px">If you did not create this account, please contact the school administrator.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">Sent by Sysnnova</p>
    </div>`;
  return send({ to, subject: `Welcome to Sysnnova - Your ${roleLabel} account`, html });
}

export async function sendGradesPublished(to, { firstName, subject, semester, academicYear, gradeLevel, section, strand, teacherName }) {
  const strandTxt = strand ? ` / ${strand}` : "";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0f766e">Your grades are ready to view</h2>
      <p>Hello ${firstName},</p>
      <p>Your grades on <strong>${subject}</strong>, submitted by <strong>${teacherName}</strong>, are now ready to view on the system. Just log in and see them for yourself.</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0"><strong>Subject</strong></td><td>${subject}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Teacher</strong></td><td>${teacherName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Class</strong></td><td>Grade ${gradeLevel}${strandTxt} - ${section}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>${semester}</strong></td><td>S.Y. ${academicYear}</td></tr>
      </table>
      <p>Log in to your student dashboard to view your grades.</p>
      <p style="color:#666;font-size:13px">This is a system-generated email, please do not reply.</p>
    </div>`;
  return send({ to, subject: `Grades ready: ${subject} (${semester})`, html });
}

export async function sendGradesSubmitted(to, { firstName, subject, semester, academicYear, gradeLevel, section, strand, teacherName, adviserName }) {
  const strandTxt = strand ? ` / ${strand}` : "";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0f766e">Your grades have been submitted for review</h2>
      <p>Hello ${firstName},</p>
      <p>Your teacher <strong>${teacherName}</strong> has submitted your <strong>${subject}</strong> grades to your adviser <strong>${adviserName}</strong> for review. Once the adviser sends them, you will receive another notification.</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0"><strong>Subject</strong></td><td>${subject}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Teacher</strong></td><td>${teacherName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Adviser</strong></td><td>${adviserName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Class</strong></td><td>Grade ${gradeLevel}${strandTxt} - ${section}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>${semester}</strong></td><td>S.Y. ${academicYear}</td></tr>
      </table>
      <p>Your adviser will review and send the final grades to you. Log in to your dashboard for updates.</p>
      <p style="color:#666;font-size:13px">This is a system-generated email, please do not reply.</p>
    </div>`;
  return send({ to, subject: `Grades submitted: ${subject} (${semester})`, html });
}

export async function sendLoginVerification(to, { firstName, code, ip }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0f766e">Verify this sign-in</h2>
      <p>Hello ${firstName},</p>
      <p>We noticed a sign-in attempt from a new device or location${ip ? ` (<strong>${ip}</strong>)` : ""}. To keep your account safe, enter the code below to approve the sign-in:</p>
      <div style="font-size:26px;font-weight:bold;letter-spacing:8px;background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;margin:16px 0">${code}</div>
      <p>This code expires in 10 minutes. If you did not try to sign in, please change your password immediately.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">Sent by Sysnnova · Protecting your account</p>
    </div>`;
  return send({ to, subject: "Verify your new sign-in - Sysnnova", html });
}

export async function sendPasswordReset(to, { firstName, code }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#0f766e">Reset your password</h2>
      <p>Hello ${firstName},</p>
      <p>We received a request to reset your password. Enter the code below on the reset password page:</p>
      <div style="font-size:26px;font-weight:bold;letter-spacing:8px;background:#f1f5f9;border-radius:8px;padding:14px;text-align:center;margin:16px 0">${code}</div>
      <p>This code expires in 10 minutes. If you did not request this, you can ignore this email and your password will stay the same.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">Sent by Sysnnova</p>
    </div>`;
  return send({ to, subject: "Reset your password - Sysnnova", html });
}

export async function verifySmtp() {
  const transport = getTransporter();
  if (!transport) return { configured: false, message: "SMTP is not configured (SMTP_HOST / SMTP_USER empty)." };
  try {
    const ok = await transport.verify();
    return { configured: true, verified: ok };
  } catch (err) {
    return { configured: true, verified: false, error: err.message };
  }
}
