import { Router } from 'express';
import * as ctrl from './social.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// Meta/LinkedIn/TikTok/Google redirect here without our auth header — must stay public.
router.get('/meta/callback', ctrl.metaCallback);
router.get('/linkedin/callback', ctrl.linkedinCallback);
router.get('/tiktok/callback', ctrl.tiktokCallback);
router.get('/youtube/callback', ctrl.youtubeCallback);

router.use(authenticate);

router.get('/connections', ctrl.listConnections);
router.delete('/connections/:id', ctrl.deleteConnection);
router.post('/connections/whatsapp', ctrl.connectClientWhatsApp);

router.get('/meta/settings', ctrl.getMetaSettings);
router.put('/meta/settings', ctrl.saveMetaSettings);
router.delete('/meta/settings', ctrl.deleteMetaSettings);
router.get('/meta/connect', ctrl.metaConnect);
router.get('/meta/pending/:token', ctrl.getPendingPageSelection);
router.post('/meta/pending/:token/confirm', ctrl.confirmPageSelection);

router.get('/linkedin/settings', ctrl.getLinkedInSettings);
router.put('/linkedin/settings', ctrl.saveLinkedInSettings);
router.delete('/linkedin/settings', ctrl.deleteLinkedInSettings);
router.get('/linkedin/connect', ctrl.linkedinConnect);
router.get('/linkedin/pending/:token', ctrl.getPendingOrgSelection);
router.post('/linkedin/pending/:token/confirm', ctrl.confirmOrgSelection);

router.get('/tiktok/settings', ctrl.getTikTokSettings);
router.put('/tiktok/settings', ctrl.saveTikTokSettings);
router.delete('/tiktok/settings', ctrl.deleteTikTokSettings);
router.get('/tiktok/connect', ctrl.tiktokConnect);

router.get('/youtube/settings', ctrl.getYouTubeSettings);
router.put('/youtube/settings', ctrl.saveYouTubeSettings);
router.delete('/youtube/settings', ctrl.deleteYouTubeSettings);
router.get('/youtube/connect', ctrl.youtubeConnect);

router.get('/whatsapp/settings', ctrl.getWhatsAppSettings);
router.post('/whatsapp/connect', ctrl.whatsappConnect);
router.get('/whatsapp/status', ctrl.whatsappStatus);
router.post('/whatsapp/disconnect', ctrl.whatsappDisconnect);
router.post('/whatsapp/send', ctrl.whatsappSend);
router.post('/whatsapp/send-content', ctrl.sendContentViaWhatsApp);

router.post('/publish', ctrl.publishContent);

export default router;
