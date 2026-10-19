import type { Request, Response } from 'express';
import * as consultasService from '../services/consultas.service.js';

export async function getResumen(_req: Request, res: Response): Promise<void> {
  const data = await consultasService.getResumen();
  res.json({ success: true, data });
}

export async function getExpedienteTrazabilidad(req: Request, res: Response): Promise<void> {
  const data = await consultasService.getExpedienteTrazabilidad(Number(req.params.id));
  res.json({ success: true, data });
}

export async function buscarExpediente(req: Request, res: Response): Promise<void> {
  const data = await consultasService.buscarExpedienteTrazabilidad({
    numero: Number(req.query.numero),
    anio: Number(req.query.anio),
  });
  res.json({ success: true, data });
}

export async function getMovimientosPorCuenta(req: Request, res: Response): Promise<void> {
  const data = await consultasService.getMovimientosPorCuenta({
    cuentaId: Number(req.params.cuentaId),
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
  });
  res.json({ success: true, data });
}

export async function buscarBeneficiario(req: Request, res: Response): Promise<void> {
  const data = await consultasService.buscarPorBeneficiario(
    req.query.search as string,
    req.query.page ? Number(req.query.page) : undefined,
    req.query.limit ? Number(req.query.limit) : undefined,
    req.query.tipo as string | undefined
  );
  res.json({ success: true, data });
}

export async function getMovimientos(req: Request, res: Response): Promise<void> {
  const data = await consultasService.getMovimientosConsolidados({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    tipo: req.query.tipo as string | undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    search: req.query.search as string | undefined,
  });
  res.json({ success: true, data });
}

export async function getEjecucionPresupuestaria(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const data = await consultasService.getEjecucionPresupuestaria(
    Number.isFinite(anio) ? anio : undefined
  );
  res.json({ success: true, data });
}

export async function exportMovimientos(req: Request, res: Response): Promise<void> {
  const movimientos = await consultasService.exportMovimientos({
    tipo: req.query.tipo as string | undefined,
    fechaDesde: req.query.fechaDesde as string | undefined,
    fechaHasta: req.query.fechaHasta as string | undefined,
    anio: req.query.anio ? Number(req.query.anio) : undefined,
    search: req.query.search as string | undefined,
  });

  const csv = consultasService.movimientosToCsv(movimientos);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="movimientos-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}

export async function exportEjecucion(req: Request, res: Response): Promise<void> {
  const anio = req.query.anio ? Number(req.query.anio) : undefined;
  const cuentas = await consultasService.getEjecucionPresupuestaria(
    Number.isFinite(anio) ? anio : undefined
  );
  const csv = consultasService.ejecucionToCsv(cuentas);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ejecucion-presupuestaria-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
