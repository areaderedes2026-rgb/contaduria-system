import type { Request, Response } from 'express';
import * as reportesService from '../services/reportes.service.js';

export async function getTipos(_req: Request, res: Response): Promise<void> {
  const data = reportesService.getTiposReporte();
  res.json({ success: true, data });
}

export async function generar(req: Request, res: Response): Promise<void> {
  const tipo = String(req.params.tipo);
  const data = await reportesService.generarReporte(tipo, {
    fechaDesde: req.query.fechaDesde,
    fechaHasta: req.query.fechaHasta,
    anio: req.query.anio,
    estado: req.query.estado,
    pagado: req.query.pagado !== undefined ? req.query.pagado === 'true' : undefined,
    medioPago: req.query.medioPago,
  });
  res.json({ success: true, data });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const tipo = String(req.params.tipo);
  const csv = await reportesService.exportReporteCsv(tipo, {
    fechaDesde: req.query.fechaDesde,
    fechaHasta: req.query.fechaHasta,
    anio: req.query.anio,
    estado: req.query.estado,
    pagado: req.query.pagado !== undefined ? req.query.pagado === 'true' : undefined,
    medioPago: req.query.medioPago,
  });

  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
