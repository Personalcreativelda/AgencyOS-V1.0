import { Router } from 'express';
import * as ctrl from './brand.controller';
import { authenticate, authorize } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

// Profile
router.get('/clients/:clientId/profile', ctrl.getProfile);
router.patch('/clients/:clientId/profile', ctrl.updateProfile);

// Reference images (mood board)
router.get('/clients/:clientId/reference-images', ctrl.getReferenceImages);
router.post('/clients/:clientId/reference-images', ctrl.createReferenceImage);
router.delete('/clients/:clientId/reference-images/:imageId', ctrl.deleteReferenceImage);

// Rules
router.get('/clients/:clientId/rules', ctrl.getRules);
router.post('/clients/:clientId/rules', ctrl.createRule);
router.patch('/clients/:clientId/rules/:ruleId', ctrl.updateRule);
router.delete('/clients/:clientId/rules/:ruleId', ctrl.deleteRule);

// Colors
router.get('/clients/:clientId/colors', ctrl.getColors);
router.post('/clients/:clientId/colors', ctrl.createColor);
router.delete('/clients/:clientId/colors/:colorId', ctrl.deleteColor);

// Fonts
router.get('/clients/:clientId/fonts', ctrl.getFonts);
router.post('/clients/:clientId/fonts', ctrl.createFont);
router.delete('/clients/:clientId/fonts/:fontId', ctrl.deleteFont);

// Products
router.get('/clients/:clientId/products', ctrl.getProducts);
router.post('/clients/:clientId/products', ctrl.createProduct);
router.patch('/clients/:clientId/products/:productId', ctrl.updateProduct);
router.delete('/clients/:clientId/products/:productId', ctrl.deleteProduct);

// Services
router.get('/clients/:clientId/services', ctrl.getServices);
router.post('/clients/:clientId/services', ctrl.createService);
router.delete('/clients/:clientId/services/:serviceId', ctrl.deleteService);

// Personas
router.get('/clients/:clientId/personas', ctrl.getPersonas);
router.post('/clients/:clientId/personas', ctrl.createPersona);
router.delete('/clients/:clientId/personas/:personaId', ctrl.deletePersona);

// Pillars
router.get('/clients/:clientId/pillars', ctrl.getPillars);
router.post('/clients/:clientId/pillars', ctrl.createPillar);
router.delete('/clients/:clientId/pillars/:pillarId', ctrl.deletePillar);

// Feedback Memory
router.get('/clients/:clientId/feedback', ctrl.getFeedback);
router.post('/clients/:clientId/feedback', ctrl.createFeedback);
router.patch('/clients/:clientId/feedback/:feedbackId', ctrl.updateFeedback);
router.delete('/clients/:clientId/feedback/:feedbackId', ctrl.deleteFeedback);

export default router;
