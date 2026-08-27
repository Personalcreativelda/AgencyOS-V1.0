import { Router } from 'express';
import * as ctrl from './clients.controller';
import { authenticate, authorize } from '../../common/middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.update);
router.delete('/:id', authorize('OWNER', 'ADMIN'), ctrl.remove);

// Contacts
router.get('/:id/contacts', ctrl.getContacts);
router.post('/:id/contacts', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.createContact);
router.patch('/:id/contacts/:contactId', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.updateContact);
router.delete('/:id/contacts/:contactId', authorize('OWNER', 'ADMIN'), ctrl.deleteContact);

// Social Accounts
router.get('/:id/social-accounts', ctrl.getSocialAccounts);
router.post('/:id/social-accounts', authorize('OWNER', 'ADMIN', 'MANAGER'), ctrl.createSocialAccount);
router.delete('/:id/social-accounts/:accountId', authorize('OWNER', 'ADMIN'), ctrl.deleteSocialAccount);

export default router;
