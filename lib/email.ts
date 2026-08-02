import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "portal@example.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function sendNewJobEmail(to: string, name: string, jobReference: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `New job ready for editing — ${jobReference}`,
    html: `
      <p>Hi ${name},</p>
      <p>A new job <strong>${jobReference}</strong> has been uploaded and is ready for you to retrieve.</p>
      <p><a href="${APP_URL}/dashboard">Log in to the portal</a> to view and download the files.</p>
    `,
  });
}

export async function sendJobCompletedEmail(to: string, name: string, jobReference: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Job completed — ${jobReference}`,
    html: `
      <p>Hi ${name},</p>
      <p>Job <strong>${jobReference}</strong> has been edited and the files are ready.</p>
      <p><a href="${APP_URL}/dashboard">Log in to the portal</a> to download the finished files.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Job Desk password",
    html: `
      <p>Hi ${name},</p>
      <p>Someone requested a password reset for your Job Desk account. If this was you, click below to choose a new password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}