import { Router } from 'express';
import * as ctrl from './email.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/settings', ctrl.getSmtpSettings);
router.put('/settings', ctrl.saveSmtpSettings);
router.delete('/settings', ctrl.deleteSmtpSettings);
router.post('/settings/test', ctrl.testSmtpSettings);

export default router;
