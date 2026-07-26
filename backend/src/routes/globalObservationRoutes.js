import express from 'express';
import {
  getGlobalObservations,
  createGlobalObservation,
  deleteGlobalObservation
} from '../controllers/globalObservationController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getGlobalObservations);
router.post('/', authenticateToken, authorize('admin'), createGlobalObservation);
router.delete('/:id', authenticateToken, authorize('admin'), deleteGlobalObservation);

export default router;
