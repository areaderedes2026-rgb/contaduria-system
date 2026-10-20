import type { Request, Response } from 'express';
import { createDatabaseBackup } from '../services/backup.service.js';

export async function downloadBackup(req: Request, res: Response): Promise<void> {
  const file = await createDatabaseBackup({
    usuarioId: req.user!.userId,
    ip: req.ip,
  });

  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Content-Length', String(file.body.length));
  res.setHeader('Cache-Control', 'no-store');
  res.send(file.body);
}
