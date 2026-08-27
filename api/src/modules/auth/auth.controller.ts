import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { AuthRequest } from '../../common/middleware/auth';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password, agencyName } = req.body;
    if (!name || !email || !password || !agencyName) {
      return res.status(400).json({ error: 'name, email, password, and agencyName are required' });
    }
    const result = await authService.register({ name, email, password, agencyName });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    const result = await authService.refreshTokens(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    // In MVP, just acknowledge the request
    const { email } = req.body;
    res.json({ message: 'If an account with that email exists, we sent a reset link.' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.id, req.user!.agencyId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, avatarUrl } = req.body;
    const user = await authService.updateMe(req.user!.id, { name, avatarUrl });
    res.json(user);
  } catch (err) {
    next(err);
  }
}
