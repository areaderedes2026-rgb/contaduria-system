import type { Request, Response } from 'express';
import * as service from '../services/libramientosAnticipo.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listLibramientosAnticipo({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getLibramientoAnticipo(Number(req.params.id)) });
}

export async function getSiguienteNumero(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  res.json({ success: true, data: await service.getSiguienteNumero(anio) });
}

export async function getResumen(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getResumen() });
}

export async function getAnticiposDisponibles(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getAnticiposDisponibles() });
}

export async function getExpedientesDisponibles(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await service.getExpedientesDisponibles() });
}

export async function getAnticipoParaLibramiento(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: await service.getAnticipoParaLibramiento(Number(req.params.anticipoId)),
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await service.createLibramientoAnticipo(req.body, req.user!.userId, getClientIp(req));
  res.status(201).json({ success: true, data });
}

export async function anular(req: Request, res: Response): Promise<void> {
  const data = await service.anularLibramientoAnticipo(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const items = await service.exportLibramientosAnticipo({
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
  });
  const csv = service.libramientosAnticipoToCsv(items);
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="libramientos-anticipo-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
