import type { Request, Response } from 'express';
import * as configuracionService from '../services/configuracion.service.js';

export async function getImpresionAfectacion(_req: Request, res: Response): Promise<void> {
  const data = await configuracionService.getImpresionAfectacion();
  res.json({ success: true, data });
}

export async function updateImpresionAfectacion(req: Request, res: Response): Promise<void> {
  const data = await configuracionService.updateImpresionAfectacion(req.body);
  res.json({ success: true, data });
}

export async function getImpresionLibramiento(_req: Request, res: Response): Promise<void> {
  const data = await configuracionService.getImpresionLibramiento();
  res.json({ success: true, data });
}

export async function updateImpresionLibramiento(req: Request, res: Response): Promise<void> {
  const data = await configuracionService.updateImpresionLibramiento(req.body);
  res.json({ success: true, data });
}

export async function getFondoARendir(_req: Request, res: Response): Promise<void> {
  const data = await configuracionService.getFondoARendirConfig();
  res.json({ success: true, data });
}

export async function updateFondoARendir(req: Request, res: Response): Promise<void> {
  const cuentaId =
    req.body?.cuenta_id === null || req.body?.cuenta_id === undefined
      ? null
      : Number(req.body.cuenta_id);
  const data = await configuracionService.updateFondoARendirConfig(
    cuentaId != null && Number.isInteger(cuentaId) ? cuentaId : null
  );
  res.json({ success: true, data });
}
