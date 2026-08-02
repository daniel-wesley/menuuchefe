import express from 'express';
import { 
  getTables, 
  getTableByNumber, 
  createTable, 
  updateTableStatus, 
  resetTable,
  deleteTable 
} from '../controllers/tableController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public: Get table details by number (used by customers checking in via QR code)
router.get('/number/:number', getTableByNumber);

// Protected: Only authenticated staff can view all tables
router.get('/', authenticateToken, getTables);

// Protected: Only admin can register new tables
router.post('/', authenticateToken, authorize('admin'), createTable);

// Protected: Staff (waiter/admin) can update table status
router.put('/:id/status', authenticateToken, authorize(['admin', 'waiter', 'cashier']), updateTableStatus);

// Protected: Staff can release/reset table
router.put('/:id/reset', authenticateToken, authorize(['admin', 'waiter', 'cashier']), resetTable);

// Protected: Only admin can delete tables
router.delete('/:id', authenticateToken, authorize('admin'), deleteTable);

export default router;
