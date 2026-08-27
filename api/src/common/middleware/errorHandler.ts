import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
  }

  // Prisma errors
  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      error: 'A record with this value already exists.',
      statusCode: 409,
    });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found.',
      statusCode: 404,
    });
  }

  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
}
