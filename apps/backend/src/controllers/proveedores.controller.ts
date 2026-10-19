import type { Request, Response } from 'express';
import * as proveedoresService from '../services/proveedores.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await proveedoresService.listProveedores({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    activo:
      req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function listActivos(req: Request, res: Response): Promise<void> {
  const data = await proveedoresService.listActivos(req.query.search as string | undefined);
  res.json({ success: true, data });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const proveedor = await proveedoresService.getProveedor(Number(req.params.id));
  res.json({ success: true, data: proveedor });
}

export async function getHistorial(req: Request, res: Response): Promise<void> {
  const historial = await proveedoresService.getHistorial(Number(req.params.id));
  res.json({ success: true, data: historial });
}

export async function getResumen(req: Request, res: Response): Promise<void> {
  const resumen = await proveedoresService.getResumen(Number(req.params.id));
  res.json({ success: true, data: resumen });
}

export async function create(req: Request, res: Response): Promise<void> {
  const proveedor = await proveedoresService.createProveedor(
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.status(201).json({ success: true, data: proveedor });
}

export async function update(req: Request, res: Response): Promise<void> {
  const proveedor = await proveedoresService.updateProveedor(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: proveedor });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await proveedoresService.deleteProveedor(
    Number(req.params.id),
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, message: 'Proveedor eliminado' });
}
