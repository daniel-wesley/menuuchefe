import express from 'express';
import {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public: Get active categories (for waiter, customer menu)
router.get('/', getCategories);

// Protected (Admin): Get all categories including inactive
router.get('/all', authenticateToken, authorize('admin'), getAllCategories);

// Protected (Admin): Create, Update, Delete categories
router.post('/', authenticateToken, authorize('admin'), createCategory);
router.put('/:id', authenticateToken, authorize('admin'), updateCategory);
router.delete('/:id', authenticateToken, authorize('admin'), deleteCategory);

export default router;
