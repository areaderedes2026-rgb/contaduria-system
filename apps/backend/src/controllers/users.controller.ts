import type { Request, Response } from 'express';
import * as usersService from '../services/users.service.js';
import { getClientIp } from '../utils/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await usersService.listUsers({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
  });
  res.json({ success: true, data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await usersService.getUser(Number(req.params.id));
  res.json({ success: true, data: user });
}

export async function create(req: Request, res: Response): Promise<void> {
  const user = await usersService.createUser(req.body, req.user!.userId, getClientIp(req));
  res.status(201).json({ success: true, data: user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateUser(
    Number(req.params.id),
    req.body,
    req.user!.userId,
    getClientIp(req)
  );
  res.json({ success: true, data: user });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await usersService.deleteUser(Number(req.params.id), req.user!.userId, getClientIp(req));
  res.json({ success: true, message: 'Usuario eliminado' });
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  const roles = await usersService.listRoles();
  res.json({ success: true, data: roles });
}
