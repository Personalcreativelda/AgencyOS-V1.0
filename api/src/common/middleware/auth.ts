import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    agencyId: string;
    role: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET!;

    const payload = jwt.verify(token, secret) as {
      sub: string;
      email: string;
      name: string;
      agencyId: string;
      role: string;
    };

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      agencyId: payload.agencyId,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(err);
    }
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

// Roles in order of permission level
const ROLE_LEVELS: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  DESIGNER: 2,
  COPYWRITER: 2,
  CLIENT: 1,
};

export function hasRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 99);
}
