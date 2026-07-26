import express from 'express';
import {
  getDeliveryOrders,
  createDeliveryOrder,
  updateDeliveryStatus,
  deleteDeliveryOrder,
  getDeliveryStats,
  lookupClientByPhone
} from '../controllers/deliveryController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

const allowed = ['admin', 'waiter', 'cashier'];

// List all delivery orders for today
router.get('/', authenticateToken, authorize(allowed), getDeliveryOrders);

// Daily stats
router.get('/stats', authenticateToken, authorize(allowed), getDeliveryStats);

// Lookup client by phone
router.get('/client/:phone', authenticateToken, authorize(allowed), lookupClientByPhone);

// Create a new delivery order
router.post('/', authenticateToken, authorize(allowed), createDeliveryOrder);

// Update delivery order status
router.put('/:id/status', authenticateToken, authorize(allowed), updateDeliveryStatus);

// Cancel / delete a delivery order
router.delete('/:id', authenticateToken, authorize(allowed), deleteDeliveryOrder);

export default router;
