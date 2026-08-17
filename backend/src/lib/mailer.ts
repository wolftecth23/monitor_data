import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendAlertEmail(to: string[], subject: string, text: string) {
  if (!transporter) {
    console.log(`[mailer] (SMTP not configured) would send to=${to.join(",")} subject="${subject}" body="${text}"`);
    return;
  }
  await transporter.sendMail({
    from: env.smtp.from,
    to: to.join(","),
    subject,
    text,
  });
}
