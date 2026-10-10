import express from 'express';
import { getPrintJobs, updatePrintJobStatus, reprintJob } from '../controllers/printJobController.js';

const router = express.Router();

router.get('/', getPrintJobs);
router.put('/:id', updatePrintJobStatus);
router.post('/:id/reprint', reprintJob);

export default router;
