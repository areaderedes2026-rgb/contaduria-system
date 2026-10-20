import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as backupController from '../controllers/backup.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', authorize('configuracion:write'), backupController.downloadBackup);

export default router;
