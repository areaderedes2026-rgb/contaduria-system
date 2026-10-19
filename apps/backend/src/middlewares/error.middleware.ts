import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { isPgUniqueViolation } from '../utils/numeracion.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  // Conflicto de unicidad (numeración / índices) bajo concurrencia multi-PC
  if (isPgUniqueViolation(err)) {
    res.status(409).json({
      success: false,
      message:
        'El registro ya existe o el número fue tomado por otro usuario. Reintente la operación.',
      code: 'DUPLICATE_RECORD',
    });
    return;
  }

  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
