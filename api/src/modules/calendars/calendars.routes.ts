import { Router } from 'express';
import * as ctrl from './calendars.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/contents', ctrl.getContents);

export default router;
