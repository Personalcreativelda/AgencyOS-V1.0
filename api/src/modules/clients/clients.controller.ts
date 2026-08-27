import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
}

function agencyCheck(client: { agencyId: string }, agencyId: string) {
  if (client.agencyId !== agencyId) throw new NotFoundError('Client not found');
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const { status, search, page = '1', limit = '20' } = req.query;

    const where: any = { agencyId, deletedAt: null };
    if (status) where.status = status;
    if (search) where.name = { contains: String(search), mode: 'insensitive' };

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        include: {
          accountManager: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { contents: true } },
        },
        orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    res.json({ data: clients, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const { name, legalName, industry, website, description, email, phone, country, city, address, logoUrl, accountManagerId, startDate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    let slug = slugify(name);
    const existing = await prisma.client.findFirst({ where: { agencyId, slug } });
    if (existing) slug = slug + '-' + Date.now().toString(36);

    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: {
          agencyId,
          name,
          legalName,
          slug,
          industry,
          website,
          description,
          email,
          phone,
          country,
          city,
          address,
          logoUrl,
          accountManagerId,
          startDate: startDate ? new Date(startDate) : null,
          status: 'ACTIVE',
        },
      });

      // Create empty brand profile
      await tx.brandProfile.create({
        data: { agencyId, clientId: c.id },
      });

      return c;
    });

    res.status(201).json(client);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const client = await prisma.client.findFirst({
      where: { id, agencyId: req.user!.agencyId, deletedAt: null },
      include: {
        accountManager: { select: { id: true, name: true, avatarUrl: true } },
        contacts: true,
        socialAccounts: true,
        brandProfile: true,
        _count: { select: { contents: true, brandRules: true } },
      },
    });
    if (!client) throw new NotFoundError('Client not found');
    res.json(client);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const agencyId = req.user!.agencyId;
    const existing = await prisma.client.findFirst({ where: { id, agencyId, deletedAt: null } });
    if (!existing) throw new NotFoundError('Client not found');

    const { name, legalName, industry, website, description, email, phone, country, city, address, status, accountManagerId, startDate, endDate, logoUrl } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: { name, legalName, industry, website, description, email, phone, country, city, address, status, accountManagerId, logoUrl, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
    });
    res.json(client);
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await prisma.client.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!existing) throw new NotFoundError('Client not found');
    await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// CONTACTS
export async function getContacts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const contacts = await prisma.clientContact.findMany({
      where: { clientId: id, agencyId: req.user!.agencyId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
    res.json(contacts);
  } catch (err) { next(err); }
}

export async function createContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, position, email, phone, isPrimary } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    if (isPrimary) {
      await prisma.clientContact.updateMany({ where: { clientId: id }, data: { isPrimary: false } });
    }

    const contact = await prisma.clientContact.create({
      data: { agencyId: req.user!.agencyId, clientId: id, name, position, email, phone, isPrimary: isPrimary || false },
    });
    res.status(201).json(contact);
  } catch (err) { next(err); }
}

export async function updateContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const { name, position, email, phone, isPrimary } = req.body;
    const contact = await prisma.clientContact.update({
      where: { id: contactId },
      data: { name, position, email, phone, isPrimary },
    });
    res.json(contact);
  } catch (err) { next(err); }
}

export async function deleteContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    await prisma.clientContact.delete({ where: { id: contactId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// SOCIAL ACCOUNTS
export async function getSocialAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const accounts = await prisma.clientSocialAccount.findMany({
      where: { clientId: id, agencyId: req.user!.agencyId },
      orderBy: { platform: 'asc' },
    });
    res.json(accounts);
  } catch (err) { next(err); }
}

export async function createSocialAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { platform, username, profileUrl } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });

    const account = await prisma.clientSocialAccount.create({
      data: { agencyId: req.user!.agencyId, clientId: id, platform, username, profileUrl, status: 'ACTIVE' },
    });
    res.status(201).json(account);
  } catch (err) { next(err); }
}

export async function deleteSocialAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { accountId } = req.params;
    await prisma.clientSocialAccount.delete({ where: { id: accountId } });
    res.status(204).send();
  } catch (err) { next(err); }
}
