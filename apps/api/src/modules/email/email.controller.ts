import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { buildTransport } from '../../integrations/email/mailer';

// ─── AGENCY SMTP SETTINGS (bring-your-own email, for approval-request notifications) ───

export async function getSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.agencySmtpSettings.findUnique({ where: { agencyId: req.user!.agencyId } });
    if (!settings) return res.json({ configured: false });

    res.json({
      configured: true,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      passwordMasked: maskSecret(decrypt(settings.passwordEncrypted)),
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      updatedAt: settings.updatedAt,
    });
  } catch (err) { next(err); }
}

export async function saveSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { host, port, secure, username, password, fromName, fromEmail } = req.body;
    if (!host || !username || !password || !fromEmail) {
      throw new ValidationError('Host, usuário, senha e email de envio são obrigatórios.');
    }

    const agencyId = req.user!.agencyId;
    const existing = await prisma.agencySmtpSettings.findUnique({ where: { agencyId } });

    const data: any = {
      host: String(host).trim(),
      port: port ? Number(port) : 587,
      secure: !!secure,
      username: String(username).trim(),
      fromName: fromName ? String(fromName).trim() : null,
      fromEmail: String(fromEmail).trim(),
    };
    // Only re-encrypt when a new password was actually provided — lets the agency update
    // host/port/from-name without having to retype a password they can't see again.
    if (password) data.passwordEncrypted = encrypt(String(password));

    const settings = existing
      ? await prisma.agencySmtpSettings.update({ where: { agencyId }, data })
      : await prisma.agencySmtpSettings.create({ data: { agencyId, ...data, passwordEncrypted: encrypt(String(password)) } });

    res.json({
      configured: true,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      passwordMasked: maskSecret(decrypt(settings.passwordEncrypted)),
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
    });
  } catch (err) { next(err); }
}

export async function deleteSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.agencySmtpSettings.deleteMany({ where: { agencyId: req.user!.agencyId } });
    res.json({ configured: false });
  } catch (err) { next(err); }
}

export async function testSmtpSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { host, port, secure, username, password, fromEmail } = req.body;
    if (!host || !username || !password) throw new ValidationError('Preencha host, usuário e senha para testar.');

    const transport = buildTransport({
      host, port: port ? Number(port) : 587, secure: !!secure, username, password, fromEmail: fromEmail || username,
    });
    await transport.verify();

    res.json({ success: true, message: 'Conexão SMTP verificada com sucesso.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Falha ao conectar ao servidor SMTP.' });
  }
}
