import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../database/prisma';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../common/middleware/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

function generateAccessToken(payload: {
  sub: string;
  email: string;
  name: string;
  agencyId: string;
  role: string;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

function generateRefreshToken() {
  return uuidv4() + '-' + uuidv4();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  agencyName: string;
}) {
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError('Email already in use');

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create agency slug
  let slug = slugify(data.agencyName);
  const existing_slug = await prisma.agency.findUnique({ where: { slug } });
  if (existing_slug) slug = slug + '-' + Date.now().toString(36);

  // Create user + agency + member in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    const agency = await tx.agency.create({
      data: {
        name: data.agencyName,
        slug,
        status: 'ACTIVE',
      },
    });

    const member = await tx.agencyMember.create({
      data: {
        agencyId: agency.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    return { user, agency, member };
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: result.user.id,
    email: result.user.email,
    name: result.user.name,
    agencyId: result.agency.id,
    role: 'OWNER',
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: result.user.id,
      token: refreshToken,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: 'OWNER',
      agency: {
        id: result.agency.id,
        name: result.agency.name,
        slug: result.agency.slug,
      },
    },
  };
}

export async function login(data: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new UnauthorizedError('Invalid email or password');

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  if (user.status !== 'ACTIVE') throw new UnauthorizedError('Account is inactive');

  // Get agency membership
  const membership = await prisma.agencyMember.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { agency: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!membership) throw new UnauthorizedError('No active agency found');

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    agencyId: membership.agencyId,
    role: membership.role,
  });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: membership.role,
      agency: {
        id: membership.agency.id,
        name: membership.agency.name,
        slug: membership.agency.slug,
        logoUrl: membership.agency.logoUrl,
      },
    },
  };
}

export async function refreshTokens(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new UnauthorizedError('User not found');

  const membership = await prisma.agencyMember.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { agency: true },
  });
  if (!membership) throw new UnauthorizedError('No active agency');

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { token } });

  const newRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    agencyId: membership.agencyId,
    role: membership.role,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: string, agencyId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('User not found');

  const membership = await prisma.agencyMember.findFirst({
    where: { userId, agencyId, status: 'ACTIVE' },
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          country: true,
          timezone: true,
          locale: true,
        },
      },
    },
  });

  return {
    ...user,
    role: membership?.role || 'MEMBER',
    agency: membership?.agency || null,
  };
}

export async function updateMe(userId: string, data: { name?: string; avatarUrl?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name, avatarUrl: data.avatarUrl },
    select: { id: true, name: true, email: true, avatarUrl: true, status: true },
  });
  return user;
}
