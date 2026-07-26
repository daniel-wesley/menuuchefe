import express from 'express';
import { getLicenseStatus, activateLicense, emergencyExtension, generateKey } from '../controllers/licenseController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/license/status - Retorna status da licença (público para que o frontend possa checar bloqueio)
router.get('/status', getLicenseStatus);

// POST /api/license/activate - Ativa o sistema com uma chave (público, mas valida internamente)
router.post('/activate', activateLicense);

// POST /api/license/emergency - Libera prazo de emergência (público, mas valida internamente)
router.post('/emergency', emergencyExtension);

// POST /api/license/generate - Gera uma chave (apenas admin)
router.post('/generate', authenticateToken, authorize('admin'), generateKey);

export default router;
