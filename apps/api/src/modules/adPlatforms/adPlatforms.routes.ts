import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import * as ctrl from './adPlatforms.controller';

const router = Router();
router.get('/:platform/callback', ctrl.callback);
router.use(authenticate);
router.get('/:platform/settings', ctrl.settings);
router.get('/:platform/connect', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.connect);
router.get('/:platform/pending/:token', ctrl.pendingOptions);
router.post('/:platform/pending/:token/confirm', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.confirm);
router.get('/:platform/connections', ctrl.connections);
router.delete('/:platform/connections/:id', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.disconnect);
router.get('/:platform/connections/:id/insights', ctrl.insights);
export default router;
