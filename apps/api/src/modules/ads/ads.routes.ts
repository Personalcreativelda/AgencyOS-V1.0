import { Router } from 'express';
import * as ctrl from './ads.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// No /meta/callback route here — the OAuth redirect lands on social.controller.ts's shared
// callback (already whitelisted on the agency's Meta App), which dispatches into
// ads.controller.ts's handleAdsMetaAuth() when state.flow === 'ads'. See adsConnect below.
router.get('/meta/connect', authenticate, ctrl.adsConnect);
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
