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

// Thrown when an external AI provider (OpenAI/Gemini/Anthropic) call fails — the message is a
// curated, safe-to-display summary (e.g. "sem créditos", "chave inválida"), never a raw stack
// trace or internal detail, so it's fine for this one to reach the user instead of being
// replaced by the generic 500 fallback below.
export class AIProviderError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

// Same idea as AIProviderError, for the Meta Graph/Marketing API — a curated, safe-to-display
// summary of what Meta itself said went wrong (e.g. a missing ads_management permission),
// instead of the generic 500 fallback.
export class MetaApiError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

// Same idea as MetaApiError, for the LinkedIn API.
export class LinkedInApiError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

// Same idea as MetaApiError, for the TikTok API.
export class TikTokApiError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

// Same idea as MetaApiError, for the YouTube Data API.
export class YouTubeApiError extends AppError {
  constructor(message: string) {
    super(message, 502);
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

  // Body over express.json's limit, or a malformed JSON body.
  if ((err as any).type === 'entity.too.large') {
    return res.status(413).json({ error: 'O conteúdo enviado é demasiado grande. Reduza o tamanho e tente novamente.', statusCode: 413 });
  }
  if ((err as any).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Os dados enviados não são válidos. Atualize a página e tente novamente.', statusCode: 400 });
  }

  // Prisma errors
  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      error: 'Já existe um registo com estes dados.',
      statusCode: 409,
    });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      error: 'Não encontrámos este item. Pode ter sido apagado.',
      statusCode: 404,
    });
  }

  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: 'O servidor teve um problema ao processar o pedido. Tente novamente em instantes.',
    statusCode: 500,
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
}
