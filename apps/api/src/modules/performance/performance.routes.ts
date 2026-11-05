import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth';
import { overview } from './performance.controller';

const router = Router();
router.use(authenticate);
router.get('/', overview);
export default router;
