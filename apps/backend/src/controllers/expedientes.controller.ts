import type { Request, Response } from 'express';
import * as expedientesService from '../services/expedientes.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await expedientesService.listExpedientes({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    estado: req.query.estado as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    proveedorId: req.query.proveedorId ? Number(req.query.proveedorId) : undefined,
    circuito:
      req.query.circuito === 'CARGO_A_RENDIR'
        ? 'CARGO_A_RENDIR'
        : req.query.circuito === 'NORMAL'
          ? 'NORMAL'
          : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const expediente = await expedientesService.getExpediente(Number(req.params.id));
  res.json({ success: true, data: expediente });
}

export async function getHistorial(req: Request, res: Response): Promise<void> {
  const historial = await expedientesService.getHistorial(Number(req.params.id));
  res.json({ success: true, data: historial });
}

export async function getSiguienteNumero(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const data = await expedientesService.getSiguienteNumero(anio);
  res.json({ success: true, data });
}

export async function getResumen(req: Request, res: Response): Promise<void> {
  const circuito =
    req.query.circuito === 'CARGO_A_RENDIR'
      ? 'CARGO_A_RENDIR'
      : req.query.circuito === 'NORMAL'
        ? 'NORMAL'
        : undefined;
  const resumen = await expedientesService.getResumen(circuito);
  res.json({ success: true, data: resumen });
}

export async function create(req: Request, res: Response): Promise<void> {
  const expediente = await expedientesService.createExpediente(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: expediente });
}

export async function update(req: Request, res: Response): Promise<void> {
  const expediente = await expedientesService.updateExpediente(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: expediente });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await expedientesService.deleteExpediente(
    Number(req.params.id),
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, message: 'Expediente eliminado' });
}

export async function anular(req: Request, res: Response): Promise<void> {
  const expediente = await expedientesService.anularExpediente(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: expediente });
}

export async function archivar(req: Request, res: Response): Promise<void> {
  const expediente = await expedientesService.archivarExpediente(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: expediente });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const expedientes = await expedientesService.exportExpedientes({
    search: req.query.search as string | undefined,
    estado: req.query.estado as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anulado: req.query.anulado !== undefined ? req.query.anulado === 'true' : undefined,
    circuito:
      req.query.circuito === 'CARGO_A_RENDIR'
        ? 'CARGO_A_RENDIR'
        : req.query.circuito === 'NORMAL'
          ? 'NORMAL'
          : undefined,
  });

  const csv = expedientesService.expedientesToCsv(expedientes);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="expedientes-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
