import type { Request, Response } from 'express';
import * as pagosService from '../services/pagos.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await pagosService.listPagos({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    medioPago: req.query.medioPago as string | undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
    libramientoId: req.query.libramientoId ? Number(req.query.libramientoId) : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const pago = await pagosService.getPago(Number(req.params.id));
  res.json({ success: true, data: pago });
}

export async function getSiguienteNumero(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const data = await pagosService.getSiguienteNumero(anio);
  res.json({ success: true, data });
}

export async function getResumen(_req: Request, res: Response): Promise<void> {
  const resumen = await pagosService.getResumen();
  res.json({ success: true, data: resumen });
}

export async function getMediosPago(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: pagosService.getMediosPago() });
}

export async function getLibramientosPendientes(_req: Request, res: Response): Promise<void> {
  const data = await pagosService.getLibramientosPendientes();
  res.json({ success: true, data });
}

export async function getLibramientoParaPago(req: Request, res: Response): Promise<void> {
  const data = await pagosService.getLibramientoParaPago(Number(req.params.libramientoId));
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response): Promise<void> {
  const pago = await pagosService.createPago(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: pago });
}

export async function anular(req: Request, res: Response): Promise<void> {
  const pago = await pagosService.anularPago(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: pago });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const pagos = await pagosService.exportPagos({
    search: req.query.search as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    medioPago: req.query.medioPago as string | undefined,
    expedienteId: req.query.expedienteId ? Number(req.query.expedienteId) : undefined,
    libramientoId: req.query.libramientoId ? Number(req.query.libramientoId) : undefined,
  });

  const csv = pagosService.pagosToCsv(pagos);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pagos-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
