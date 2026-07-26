import { getDbConnection } from '../config/db.js';

export async function getNextNumber(req, res) {
  try {
    const db = await getDbConnection();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let counter = await db.get(
      'SELECT last_number FROM dav_counters WHERE year = ? AND month = ?',
      [year, month]
    );

    if (!counter) {
      await db.run(
        'INSERT INTO dav_counters (year, month, last_number) VALUES (?, ?, 0)',
        [year, month]
      );
      counter = { last_number: 0 };
    }

    const nextNumber = counter.last_number + 1;

    await db.run(
      'UPDATE dav_counters SET last_number = ? WHERE year = ? AND month = ?',
      [nextNumber, year, month]
    );

    const formattedNumber = String(nextNumber).padStart(6, '0');
    const davCode = `001/${month.toString().padStart(2, '0')}/${year}`;

    return res.json({
      dav_number: formattedNumber,
      dav_code: davCode,
      period: `${month.toString().padStart(2, '0')}/${year}`
    });
  } catch (error) {
    console.error('Erro ao gerar número DAV:', error);
    return res.status(500).json({ error: 'Erro ao gerar número DAV' });
  }
}

export async function listDavs(req, res) {
  try {
    const db = await getDbConnection();
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const counter = await db.get(
      'SELECT last_number FROM dav_counters WHERE year = ? AND month = ?',
      [currentYear, currentMonth]
    );

    return res.json({
      period: `${currentMonth.toString().padStart(2, '0')}/${currentYear}`,
      total_davs: counter ? counter.last_number : 0
    });
  } catch (error) {
    console.error('Erro ao listar DAVs:', error);
    return res.status(500).json({ error: 'Erro ao listar DAVs' });
  }
}
