import { Router } from 'express';
import * as ctrl from './agencies.controller';
import { authenticate, authorize } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/current', ctrl.getCurrent);
router.patch('/current', authorize('OWNER', 'ADMIN'), ctrl.updateCurrent);
router.get('/current/members', ctrl.getMembers);
router.post('/current/members/invite', authorize('OWNER', 'ADMIN'), ctrl.inviteMember);
router.patch('/current/members/:id', authorize('OWNER', 'ADMIN'), ctrl.updateMember);
router.delete('/current/members/:id', authorize('OWNER'), ctrl.removeMember);

export default router;
