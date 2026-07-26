import bcrypt from 'bcryptjs';
import { getDbConnection } from '../config/db.js';

export async function getUsers(req, res) {
  try {
    const db = await getDbConnection();
    // Return all users excluding password hashes for safety
    const users = await db.all('SELECT id, username, role, name FROM users ORDER BY name ASC');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Erro ao buscar funcionários.' });
  }
}

export async function createUser(req, res) {
  const { username, password, role, name } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const validRoles = ['admin', 'waiter', 'kitchen', 'cashier'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Cargo/papel inválido.' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);

    if (existing) {
      return res.status(400).json({ message: 'Nome de usuário já está em uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?) RETURNING id',
      [username, hashedPassword, role, name]
    );

    res.status(201).json({
      id: result.lastID,
      username,
      role,
      name
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Erro ao cadastrar funcionário.' });
  }
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { username, password, role, name } = req.body;

  if (!username || !role || !name) {
    return res.status(400).json({ message: 'Nome, usuário e cargo são obrigatórios.' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ message: 'Funcionário não encontrado.' });
    }

    // Check if username is being changed and is already taken
    if (username !== user.username) {
      const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
      if (existing) {
        return res.status(400).json({ message: 'Nome de usuário já está em uso.' });
      }
    }

    let query = 'UPDATE users SET username = ?, role = ?, name = ?';
    const params = [username, role, name];

    // Update password only if provided
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.run(query, params);

    res.json({
      id: parseInt(id),
      username,
      role,
      name
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Erro ao atualizar funcionário.' });
  }
}

export async function deleteUser(req, res) {
  const { id } = req.params;

  // Prevent self-deletion
  if (req.user && req.user.id === parseInt(id)) {
    return res.status(400).json({ message: 'Não é possível excluir o próprio usuário logado.' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ message: 'Funcionário não encontrado.' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = \'admin\'');
      if (adminCount.count <= 1) {
        return res.status(400).json({ message: 'Não é possível excluir o único administrador do sistema.' });
      }
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Funcionário excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Erro ao excluir funcionário.' });
  }
}
