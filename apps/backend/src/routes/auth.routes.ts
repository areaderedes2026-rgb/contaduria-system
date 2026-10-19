import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Demasiados intentos de inicio de sesión. Espere unos minutos e intente de nuevo.',
});

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);

export default router;
