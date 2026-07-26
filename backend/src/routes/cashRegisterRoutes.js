import express from 'express';
import {
  getCashRegisterStatus,
  openCashRegister,
  closeCashRegister,
  getCashRegisterHistory,
  withdrawCash,
  getWithdrawals
} from '../controllers/cashRegisterController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get current cash register status (open/closed)
router.get('/status', authenticateToken, authorize(['admin', 'cashier']), getCashRegisterStatus);

// Open a new cash register session
router.post('/open', authenticateToken, authorize(['admin', 'cashier']), openCashRegister);

// Close the current cash register session (blocks if tables are open)
router.post('/close', authenticateToken, authorize(['admin', 'cashier']), closeCashRegister);

// Register a cash withdrawal (sangria)
router.post('/withdrawal', authenticateToken, authorize(['admin', 'cashier']), withdrawCash);

// Get all withdrawals for the current open session
router.get('/withdrawals', authenticateToken, authorize(['admin', 'cashier']), getWithdrawals);

// Get cash register session history (admin only)
router.get('/history', authenticateToken, authorize(['admin']), getCashRegisterHistory);

export default router;
