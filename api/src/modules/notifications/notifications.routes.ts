import { Router } from 'express';
import * as ctrl from './notifications.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/:id/read', ctrl.markRead);
router.post('/read-all', ctrl.markAllRead);

export default router;
