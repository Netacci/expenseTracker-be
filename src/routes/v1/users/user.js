import { Router } from 'express';
import {
  changePassword,
  deleteUser,
  editProfile,
  getUser,
} from '../../../controller/v1/users/user.js';
import authenticate from '../../../middlewares/authenticate.js';

const router = Router();
router.get('/', authenticate('user'), getUser);
router.delete('/', authenticate('user'), deleteUser);
router.put('/change-password', authenticate('user'), changePassword);
router.put('/edit-profile', authenticate('user'), editProfile);

export default router;
