import express from 'express';
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../controllers/userController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// All staff/user CRUD endpoints are strictly restricted to Administrators
router.use(authenticateToken, authorize('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
