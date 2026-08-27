import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateMe);

export default router;
