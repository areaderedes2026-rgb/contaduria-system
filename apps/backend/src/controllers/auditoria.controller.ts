import type { Request, Response } from 'express';
import * as auditoriaService from '../services/auditoria.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await auditoriaService.listAuditoria({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
    accion: req.query.accion as string | undefined,
    entidad: req.query.entidad as string | undefined,
    entidadId: req.query.entidadId ? Number(req.query.entidadId) : undefined,
    search: req.query.search as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const registro = await auditoriaService.getAuditoriaRegistro(Number(req.params.id));
  res.json({ success: true, data: registro });
}

export async function getByEntidad(req: Request, res: Response): Promise<void> {
  const entidad = String(req.params.entidad);
  const data = await auditoriaService.getAuditoriaPorEntidad(
    entidad,
    Number(req.params.entidadId)
  );
  res.json({ success: true, data });
}

export async function getResumen(_req: Request, res: Response): Promise<void> {
  const data = await auditoriaService.getResumen();
  res.json({ success: true, data });
}

export async function getFiltros(_req: Request, res: Response): Promise<void> {
  const data = await auditoriaService.getFiltros();
  res.json({ success: true, data });
}

export async function getMetadata(_req: Request, res: Response): Promise<void> {
  const data = auditoriaService.getMetadata();
  res.json({ success: true, data });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const registros = await auditoriaService.exportAuditoria({
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
    accion: req.query.accion as string | undefined,
    entidad: req.query.entidad as string | undefined,
    entidadId: req.query.entidadId ? Number(req.query.entidadId) : undefined,
    search: req.query.search as string | undefined,
  });

  const csv = auditoriaService.auditoriaToCsv(registros);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="auditoria-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
