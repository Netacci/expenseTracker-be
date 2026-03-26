import { Router } from 'express';
import authenticate from '../../../middlewares/authenticate.js';
import {
  createSubscription,
  getAllSubscriptions,
  editSubscription,
  deleteSubscription,
} from '../../../controller/v1/users/subscription.js';

const router = Router();

router.post('/create', authenticate('user'), createSubscription);
router.get('/', authenticate('user'), getAllSubscriptions);
router.put('/:subscription_id', authenticate('user'), editSubscription);
router.delete('/:subscription_id', authenticate('user'), deleteSubscription);

export default router;
