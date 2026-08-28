import { Router } from 'express';
import * as ctrl from './approvals.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// Authenticated routes (agency side)
router.post('/contents/:contentId/request', authenticate, ctrl.requestApproval);
router.post('/contents/:contentId/send-email', authenticate, ctrl.sendApprovalEmailManual);
router.post('/contents/:contentId/send-whatsapp', authenticate, ctrl.sendApprovalWhatsAppManual);
router.get('/', authenticate, ctrl.listApprovals);
router.delete('/:id', authenticate, ctrl.deleteApproval);

// Public routes (client portal - token based, no auth)
router.get('/portal/:token', ctrl.getPortal);
router.post('/portal/:token/view', ctrl.markViewed);
router.post('/portal/:token/approve', ctrl.approve);
router.post('/portal/:token/request-changes', ctrl.requestChanges);
router.post('/portal/:token/reject', ctrl.reject);
router.post('/portal/:token/comment', ctrl.addComment);

export default router;
