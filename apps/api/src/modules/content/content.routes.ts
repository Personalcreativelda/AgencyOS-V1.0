import { Router } from 'express';
import * as ctrl from './content.controller';
import { authenticate } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/change-status', ctrl.changeStatus);
router.post('/:id/duplicate', ctrl.duplicate);

// Platforms
router.get('/:id/platforms', ctrl.getPlatforms);
router.post('/:id/platforms', ctrl.addPlatform);
router.delete('/:id/platforms/:platformId', ctrl.removePlatform);

// Versions
router.get('/:id/versions', ctrl.getVersions);
router.post('/:id/versions', ctrl.createVersion);

// Comments
router.get('/:id/comments', ctrl.getComments);
router.post('/:id/comments', ctrl.addComment);
router.patch('/:id/comments/:commentId', ctrl.updateComment);

export default router;
