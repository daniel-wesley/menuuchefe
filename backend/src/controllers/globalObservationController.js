import { getDbConnection } from '../config/db.js';

export async function getGlobalObservations(req, res) {
  try {
    const db = await getDbConnection();
    const observations = await db.all('SELECT * FROM global_observations ORDER BY id ASC');
    res.json(observations);
  } catch (error) {
    console.error('Error fetching global observations:', error);
    res.status(500).json({ message: 'Erro ao buscar observações.' });
  }
}

export async function createGlobalObservation(req, res) {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Texto da observação é obrigatório.' });
  }

  try {
    const db = await getDbConnection();
    const result = await db.run(
      'INSERT INTO global_observations (text) VALUES (?)',
      [text.trim()]
    );

    res.status(201).json({ id: result.lastID, text: text.trim() });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(409).json({ message: 'Esta observação já existe.' });
    }
    console.error('Error creating global observation:', error);
    res.status(500).json({ message: 'Erro ao criar observação.' });
  }
}

export async function deleteGlobalObservation(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const obs = await db.get('SELECT * FROM global_observations WHERE id = ?', [id]);

    if (!obs) {
      return res.status(404).json({ message: 'Observação não encontrada.' });
    }

    await db.run('DELETE FROM global_observations WHERE id = ?', [id]);
    res.json({ message: 'Observação removida com sucesso.' });
  } catch (error) {
    console.error('Error deleting global observation:', error);
    res.status(500).json({ message: 'Erro ao remover observação.' });
  }
}
