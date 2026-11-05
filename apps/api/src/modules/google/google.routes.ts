import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import * as ctrl from './google.controller';

const router = Router();
router.get('/callback', ctrl.callback);
router.use(authenticate);
router.get('/settings', ctrl.settings);
router.get('/connect', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.connect);
router.get('/pending/:token', ctrl.pending);
router.post('/pending/:token/confirm', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.confirm);
router.get('/connections', ctrl.connections);
router.delete('/connections/:id', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.disconnect);
router.get('/connections/:id/insights', ctrl.insights);
router.post('/connections/:id/analyze', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.analyze);
router.post('/connections/:id/campaigns/:campaignId/status', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.campaignStatus);
export default router;
