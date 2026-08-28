import { Router } from 'express';
import * as ctrl from './ads.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// OAuth callback is hit by Meta's redirect (no auth header) — everything else is agency-side.
router.get('/meta/connect', authenticate, ctrl.adsConnect);
router.get('/meta/callback', ctrl.adsMetaCallback);
router.get('/meta/pending/:token', authenticate, ctrl.getPendingAdAccountSelection);
router.post('/meta/pending/:token/confirm', authenticate, ctrl.confirmAdAccountSelection);

router.get('/accounts', authenticate, ctrl.listAdAccounts);
router.delete('/accounts/:id', authenticate, ctrl.deleteAdAccount);
router.post('/accounts/:id/sync', authenticate, ctrl.syncAdAccount);
router.get('/accounts/:id/insights', authenticate, ctrl.getAdInsights);
router.post('/accounts/:id/analyze', authenticate, ctrl.analyzeAdAccount);

router.get('/recommendations', authenticate, ctrl.listRecommendations);
router.post('/recommendations/:id/apply', authenticate, ctrl.applyRecommendation);
router.post('/recommendations/:id/dismiss', authenticate, ctrl.dismissRecommendation);

export default router;
