import nodemailer from 'nodemailer';
import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName?: string | null;
  fromEmail: string;
}

export function buildTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
  });
}

export async function getAgencySmtpConfig(agencyId: string): Promise<SmtpConfig | null> {
  const settings = await prisma.agencySmtpSettings.findUnique({ where: { agencyId } });
  if (!settings) return null;
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    password: decrypt(settings.passwordEncrypted),
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
  };
}

export async function sendMail(config: SmtpConfig, opts: { to: string; subject: string; html: string }) {
  const transport = buildTransport(config);
  const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
  await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
}
