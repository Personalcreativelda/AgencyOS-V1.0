import { Router } from 'express';
import * as ctrl from './reports.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// Public report
router.get('/public/:token', ctrl.getPublicReport);

// Authenticated
router.use(authenticate);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/publish', ctrl.publish);

export default router;
