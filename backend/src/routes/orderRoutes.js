import express from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  getActiveOrdersByTable, 
  updateOrderStatus,
  cancelOrderItem,
  cancelTableOrders
} from '../controllers/orderController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Optional authentication middleware for order creation
// (Can be created by customer via QR code or waiter/admin)
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  }
  // Proceed as guest/customer if no token is provided
  next();
};

// Create Order (Open to customers and staff)
router.post('/', optionalAuthenticate, createOrder);

// Active orders of a specific table (used by cashier and customer menu summary)
router.get('/table/:tableNumber/active', getActiveOrdersByTable);

// Protected: Only staff can list all orders or view specific details
router.get('/', authenticateToken, authorize(['admin', 'waiter', 'kitchen']), getOrders);
router.get('/:id', authenticateToken, authorize(['admin', 'waiter', 'kitchen']), getOrderById);

// Protected: Staff can update preparation status of orders
router.put('/:id/status', authenticateToken, authorize(['admin', 'kitchen', 'waiter']), updateOrderStatus);

// Protected: Cashier/Admin/Waiter can cancel individual items or all orders of a table
router.delete('/item/:orderItemId', authenticateToken, authorize(['admin', 'waiter', 'cashier']), cancelOrderItem);
router.delete('/table/:tableId/cancel-all', authenticateToken, authorize(['admin', 'waiter', 'cashier']), cancelTableOrders);

export default router;
