import type { Request, Response } from 'express';
import * as cuentasService from '../services/cuentas.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await cuentasService.listCuentas({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    codigoExacto: req.query.codigoExacto as string | undefined,
    tipo: req.query.tipo as string | undefined,
    estado: req.query.estado as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const cuenta = await cuentasService.getCuenta(Number(req.params.id));
  res.json({ success: true, data: cuenta });
}

export async function getHistorial(req: Request, res: Response): Promise<void> {
  const historial = await cuentasService.getHistorial(Number(req.params.id));
  res.json({ success: true, data: historial });
}

export async function getHijos(req: Request, res: Response): Promise<void> {
  const hijos = await cuentasService.getHijos(Number(req.params.id));
  res.json({ success: true, data: hijos });
}

export async function getAfectaciones(req: Request, res: Response): Promise<void> {
  const afectaciones = await cuentasService.getAfectaciones(Number(req.params.id));
  res.json({ success: true, data: afectaciones });
}

export async function getMovimientos(req: Request, res: Response): Promise<void> {
  const movimientos = await cuentasService.getMovimientos(Number(req.params.id));
  res.json({ success: true, data: movimientos });
}

export async function ajustarSaldo(req: Request, res: Response): Promise<void> {
  const cuenta = await cuentasService.ajustarSaldo(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: cuenta });
}

export async function getArbol(req: Request, res: Response): Promise<void> {
  const arbol = await cuentasService.getArbol({
    tipo: req.query.tipo as string | undefined,
    estado: req.query.estado as string | undefined,
  });
  res.json({ success: true, data: arbol });
}

export async function getPadres(_req: Request, res: Response): Promise<void> {
  const padres = await cuentasService.getPadresOptions();
  res.json({ success: true, data: padres });
}

export async function getResumen(_req: Request, res: Response): Promise<void> {
  const resumen = await cuentasService.getResumen();
  res.json({ success: true, data: resumen });
}

export async function create(req: Request, res: Response): Promise<void> {
  const cuenta = await cuentasService.createCuenta(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: cuenta });
}

export async function update(req: Request, res: Response): Promise<void> {
  const cuenta = await cuentasService.updateCuenta(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: cuenta });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await cuentasService.deleteCuenta(
    Number(req.params.id),
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, message: 'Cuenta eliminada' });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const cuentas = await cuentasService.exportCuentas({
    search: req.query.search as string | undefined,
    tipo: req.query.tipo as string | undefined,
    estado: req.query.estado as string | undefined,
  });

  const csv = cuentasService.cuentasToCsv(cuentas);
  const fecha = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="plan-cuentas-${fecha}.csv"`);
  res.send('\uFEFF' + csv);
}
