import express from 'express';
import { 
  checkoutTable, 
  getDailyClosure, 
  getAdminDashboardStats,
  getDetailedReports,
  getSalesByWaiter
} from '../controllers/reportController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Checkout table: process payments (Cashier and Waiters allowed)
router.post('/checkout', authenticateToken, authorize(['admin', 'waiter', 'cashier']), checkoutTable);

// Daily cash register closure (Admins and Cashiers allowed)
router.get('/closure', authenticateToken, authorize(['admin', 'cashier', 'waiter']), getDailyClosure);

// Admin dashboard statistics and metrics (Admins only)
router.get('/stats', authenticateToken, authorize('admin'), getAdminDashboardStats);

// Detailed analytics reports (Admins only)
router.get('/detailed', authenticateToken, authorize('admin'), getDetailedReports);

// Sales by specific waiter (Admins only)
router.get('/waiter-sales', authenticateToken, authorize('admin'), getSalesByWaiter);

export default router;
