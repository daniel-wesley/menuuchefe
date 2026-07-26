import { getDbConnection } from '../config/db.js';

export async function getTables(req, res) {
  try {
    const db = await getDbConnection();
    const tables = await db.all('SELECT * FROM tables ORDER BY number ASC');
    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Erro ao carregar mesas.' });
  }
}

export async function getTableByNumber(req, res) {
  const { number } = req.params;
  const { token } = req.query; // optional for client access verification

  try {
    const db = await getDbConnection();
    const table = await db.get('SELECT * FROM tables WHERE number = ?', [number]);

    if (!table) {
      return res.status(404).json({ message: `Mesa ${number} não encontrada.` });
    }

    // If client is accessing, we verify the token to prevent unauthorized orders
    if (token && table.token !== token) {
      return res.status(403).json({ message: 'Acesso negado: QR Code inválido ou expirado.' });
    }

    res.json(table);
  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).json({ message: 'Erro ao carregar detalhes da mesa.' });
  }
}

export async function createTable(req, res) {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ message: 'Número da mesa é obrigatório.' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM tables WHERE number = ?', [number]);
    if (existing) {
      return res.status(400).json({ message: `Mesa ${number} já cadastrada.` });
    }

    const tableToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const result = await db.run(
      'INSERT INTO tables (number, status, token) VALUES (?, ?, ?) RETURNING id',
      [number, 'free', tableToken]
    );

    const newTable = { id: result.lastID, number, status: 'free', token: tableToken };

    // Broadcast change
    const io = req.app.get('io');
    if (io) {
      io.emit('table_status_changed', newTable);
    }

    res.status(201).json(newTable);
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ message: 'Erro ao cadastrar mesa.' });
  }
}

export async function updateTableStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['free', 'occupied', 'waiting_payment'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  try {
    const db = await getDbConnection();
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [id]);
    
    if (!table) {
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    await db.run('UPDATE tables SET status = ? WHERE id = ?', [status, id]);
    
    const updatedTable = { ...table, status };

    // Broadcast change
    const io = req.app.get('io');
    if (io) {
      io.emit('table_status_changed', updatedTable);
    }

    res.json(updatedTable);
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({ message: 'Erro ao atualizar status da mesa.' });
  }
}

export async function resetTable(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [id]);

    if (!table) {
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    // Generate a brand new token when releasing the table
    // This invalidates old scanned QR Codes and guarantees security
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await db.run('UPDATE tables SET status = \'free\', token = ? WHERE id = ?', [newToken, id]);

    const updatedTable = { ...table, status: 'free', token: newToken };

    // Broadcast change
    const io = req.app.get('io');
    if (io) {
      io.emit('table_status_changed', updatedTable);
    }

    res.json({ message: 'Mesa liberada com sucesso.', table: updatedTable });
  } catch (error) {
    console.error('Error resetting table:', error);
    res.status(500).json({ message: 'Erro ao liberar mesa.' });
  }
}
