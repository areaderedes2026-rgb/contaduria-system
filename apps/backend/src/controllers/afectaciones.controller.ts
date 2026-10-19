import type { Request, Response } from 'express';
import * as afectacionesService from '../services/afectaciones.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await afectacionesService.listAfectaciones({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulada: req.query.anulada !== undefined ? req.query.anulada === 'true' : undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const afectacion = await afectacionesService.getAfectacion(Number(req.params.id));
  res.json({ success: true, data: afectacion });
}

export async function getSiguienteNumero(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const data = await afectacionesService.getSiguienteNumero(anio);
  res.json({ success: true, data });
}

export async function update(req: Request, res: Response): Promise<void> {
  const afectacion = await afectacionesService.updateAfectacion(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: afectacion });
}

export async function getResumen(_req: Request, res: Response): Promise<void> {
  const resumen = await afectacionesService.getResumen();
  res.json({ success: true, data: resumen });
}

export async function getExpedientesDisponibles(_req: Request, res: Response): Promise<void> {
  const data = await afectacionesService.getExpedientesDisponibles();
  res.json({ success: true, data });
}

export async function getCuentasDisponibles(req: Request, res: Response): Promise<void> {
  const afectacionId = req.query.afectacionId ? Number(req.query.afectacionId) : undefined;
  const data = await afectacionesService.getCuentasDisponibles(afectacionId);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const afectacion = await afectacionesService.createAfectacion(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: afectacion });
}

export async function anular(req: Request, res: Response): Promise<void> {
  const afectacion = await afectacionesService.anularAfectacion(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: afectacion });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const afectaciones = await afectacionesService.exportAfectaciones({
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulada: req.query.anulada !== undefined ? req.query.anulada === 'true' : undefined,
  });

  const csv = afectacionesService.afectacionesToCsv(afectaciones);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="afectaciones-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
