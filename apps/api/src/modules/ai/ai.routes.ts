import { Router } from 'express';
import * as ctrl from './ai.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/analyze-brand', ctrl.analyzeBrand);
router.post('/generate-strategy', ctrl.generateStrategy);
router.post('/generate-calendar', ctrl.generateCalendar);
router.post('/generate-caption', ctrl.generateCaption);
router.post('/generate-hook', ctrl.generateHook);
router.post('/generate-cta', ctrl.generateCta);
router.post('/generate-hashtags', ctrl.generateHashtags);
router.post('/generate-image', ctrl.generateImageProposal);
router.post('/rewrite', ctrl.rewrite);
router.post('/analyze-feedback', ctrl.analyzeFeedback);

// Agency-level AI integration (bring-your-own API key)
router.get('/settings', ctrl.getAiSettings);
router.put('/settings', ctrl.saveAiSettings);
router.delete('/settings', ctrl.deleteAiSettings);
router.post('/settings/test', ctrl.testAiSettings);

export default router;
