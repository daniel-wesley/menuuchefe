import express from 'express';
import { getLoja, updateLoja } from '../controllers/lojaController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// GET /api/loja é público para que clientes, garçons e caixas possam acessar sem autenticação obrigatória se necessário
router.get('/', getLoja);

// POST /api/loja é restrito a administradores autenticados
router.post('/', authenticateToken, authorize('admin'), updateLoja);

export default router;
