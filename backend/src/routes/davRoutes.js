import express from 'express';
import { getNextNumber, listDavs } from '../controllers/davController.js';

const router = express.Router();

router.get('/next-number', getNextNumber);
router.get('/list', listDavs);

export default router;
