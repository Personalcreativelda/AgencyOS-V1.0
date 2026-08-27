import { Router } from 'express';
import * as ctrl from './dashboard.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/overview', ctrl.overview);
router.get('/attention', ctrl.attention);

export default router;
