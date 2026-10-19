import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import type { JwtPayload } from '../entities/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Token no proporcionado', 'NO_TOKEN'));
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, 'Token inválido o expirado', 'INVALID_TOKEN'));
  }
}

export function authorize(...permisosRequeridos: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'No autenticado', 'UNAUTHORIZED'));
      return;
    }

    const tienePermiso = permisosRequeridos.some((p) => req.user!.permisos.includes(p));

    if (!tienePermiso) {
      next(new AppError(403, 'No tiene permisos para esta acción', 'FORBIDDEN'));
      return;
    }

    next();
  };
}
