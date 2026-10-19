import type { Request, Response } from 'express';
import * as libramientosService from '../services/libramientos.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await libramientosService.listLibramientos({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    pagado: req.query.pagado !== undefined ? req.query.pagado === 'true' : undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const libramiento = await libramientosService.getLibramiento(Number(req.params.id));
  res.json({ success: true, data: libramiento });
}

export async function getSiguienteNumero(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const data = await libramientosService.getSiguienteNumero(anio);
  res.json({ success: true, data });
}

export async function getResumen(req: Request, res: Response): Promise<void> {
  const circuito =
    req.query.circuito === 'CARGO_A_RENDIR'
      ? 'CARGO_A_RENDIR'
      : req.query.circuito === 'NORMAL'
        ? 'NORMAL'
        : undefined;
  const resumen = await libramientosService.getResumen(circuito);
  res.json({ success: true, data: resumen });
}

function parseCircuitoQuery(value: unknown) {
  if (value === 'CARGO_A_RENDIR' || value === 'NORMAL') return value;
  return undefined;
}

export async function listConsolidados(req: Request, res: Response): Promise<void> {
  const result = await libramientosService.listLibramientosConsolidados({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    circuito: parseCircuitoQuery(req.query.circuito),
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function exportConsolidadosCsv(req: Request, res: Response): Promise<void> {
  const items = await libramientosService.exportLibramientosConsolidados({
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    circuito: parseCircuitoQuery(req.query.circuito),
  });
  const csv = libramientosService.libramientosConsolidadosToCsv(items);
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="libramientos-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}

export async function getAfectacionesDisponibles(_req: Request, res: Response): Promise<void> {
  const data = await libramientosService.getAfectacionesDisponibles();
  res.json({ success: true, data });
}

export async function getExpedientesDisponibles(_req: Request, res: Response): Promise<void> {
  const data = await libramientosService.getExpedientesDisponiblesLibramiento();
  res.json({ success: true, data });
}

export async function getAfectacionParaLibramiento(req: Request, res: Response): Promise<void> {
  const data = await libramientosService.getAfectacionParaLibramiento(Number(req.params.afectacionId));
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const libramiento = await libramientosService.createLibramiento(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: libramiento });
}

export async function anular(req: Request, res: Response): Promise<void> {
  const libramiento = await libramientosService.anularLibramiento(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: libramiento });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const libramientos = await libramientosService.exportLibramientos({
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    pagado: req.query.pagado !== undefined ? req.query.pagado === 'true' : undefined,
  });

  const csv = libramientosService.libramientosToCsv(libramientos);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="libramientos-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
