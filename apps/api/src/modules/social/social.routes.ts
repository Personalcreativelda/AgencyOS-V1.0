import { Router } from 'express';
import * as ctrl from './social.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

// Meta redirects here without our auth header — must stay public.
router.get('/meta/callback', ctrl.metaCallback);

router.use(authenticate);

router.get('/connections', ctrl.listConnections);
router.delete('/connections/:id', ctrl.deleteConnection);

router.get('/meta/settings', ctrl.getMetaSettings);
router.put('/meta/settings', ctrl.saveMetaSettings);
router.delete('/meta/settings', ctrl.deleteMetaSettings);
router.get('/meta/connect', ctrl.metaConnect);
router.get('/meta/pending/:token', ctrl.getPendingPageSelection);
router.post('/meta/pending/:token/confirm', ctrl.confirmPageSelection);

router.get('/whatsapp/settings', ctrl.getWhatsAppSettings);
router.post('/whatsapp/connect', ctrl.whatsappConnect);
router.get('/whatsapp/status', ctrl.whatsappStatus);
router.post('/whatsapp/disconnect', ctrl.whatsappDisconnect);
router.post('/whatsapp/send', ctrl.whatsappSend);
router.post('/whatsapp/send-content', ctrl.sendContentViaWhatsApp);

router.post('/publish', ctrl.publishContent);

export default router;
