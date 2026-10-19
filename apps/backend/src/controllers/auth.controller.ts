import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { getClientIp } from '../utils/errors.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = loginSchema.parse(req.body);
  const result = await authService.login(username, password, getClientIp(req));
  res.json({ success: true, data: result });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
}
