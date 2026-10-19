import type { Request, Response } from 'express';
import { getDashboardStats } from '../services/dashboard.service.js';

export async function getStats(_req: Request, res: Response): Promise<void> {
  const stats = await getDashboardStats();
  res.json({ success: true, data: stats });
}
