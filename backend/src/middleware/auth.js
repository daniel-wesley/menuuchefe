import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getDbConnection } from '../config/db.js';

dotenv.config();

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the active session from the database
    const db = await getDbConnection();
    const user = await db.get('SELECT current_session_id, role, name FROM users WHERE id = ?', [decoded.id]);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }

    // Verify if the session ID matches (single session check)
    if (user.current_session_id !== decoded.sessionId) {
      return res.status(401).json({ message: 'Sua conta foi conectada em outro dispositivo. Login expirado.' });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: user.role,
      name: user.name,
      sessionId: decoded.sessionId
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
}

export function authorize(roles = []) {
  // roles can be a string or an array of strings (e.g., 'admin' or ['admin', 'waiter'])
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado.' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado: permissão insuficiente.' });
    }

    next();
  };
}
