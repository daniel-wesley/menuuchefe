import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDbConnection } from '../config/db.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
    }

    // Generate a unique session ID for this login
    const sessionId = crypto.randomUUID();

    // Update database with the new sessionId
    await db.run('UPDATE users SET current_session_id = ? WHERE id = ?', [sessionId, user.id]);

    // Generate JWT including sessionId
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

export async function me(req, res) {
  try {
    const db = await getDbConnection();
    const user = await db.get('SELECT id, username, role, name FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Erro interno ao carregar perfil.' });
  }
}
