import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  updateStock 
} from '../controllers/productController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import upload from '../config/multer.js';

const router = express.Router();

// Public: Anyone can fetch the menu products
router.get('/', getProducts);
router.get('/:id', getProductById);

// Protected (Admin): Manage product catalogue with image uploads
router.post('/', authenticateToken, authorize('admin'), upload.single('image'), createProduct);
router.put('/:id', authenticateToken, authorize('admin'), upload.single('image'), updateProduct);
router.delete('/:id', authenticateToken, authorize('admin'), deleteProduct);

// Protected (Admin/Kitchen): Update stock levels
router.put('/:id/stock', authenticateToken, authorize(['admin', 'kitchen']), updateStock);

export default router;
