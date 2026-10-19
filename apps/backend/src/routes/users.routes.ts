import { Router } from 'express';
import * as usersController from '../controllers/users.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/roles', authorize('usuarios:read', 'usuarios:write'), usersController.listRoles);
router.get('/', authorize('usuarios:read', 'usuarios:write'), usersController.list);
router.get('/:id', authorize('usuarios:read', 'usuarios:write'), usersController.getById);
router.post('/', authorize('usuarios:write'), usersController.create);
router.put('/:id', authorize('usuarios:write'), usersController.update);
router.delete('/:id', authorize('usuarios:write'), usersController.remove);

export default router;
