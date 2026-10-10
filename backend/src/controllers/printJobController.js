import { getDbConnection } from '../config/db.js';

export async function getPrintJobs(req, res) {
  try {
    const db = await getDbConnection();
    const jobs = await db.all('SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT 100');
    
    // Parse items_json into array
    const formattedJobs = jobs.map(job => {
      let items = [];
      try {
        items = typeof job.items_json === 'string' ? JSON.parse(job.items_json) : job.items_json;
      } catch (e) {
        items = [];
      }
      return { ...job, items };
    });

    res.json(formattedJobs);
  } catch (error) {
    console.error('Erro ao buscar fila de impressão:', error);
    res.status(500).json({ message: 'Erro ao buscar trabalhos de impressão.' });
  }
}

export async function updatePrintJobStatus(req, res) {
  const { id } = req.params;
  const { status, error_message } = req.body;

  try {
    const db = await getDbConnection();
    await db.run(
      `UPDATE print_jobs SET status = ?, error_message = ?, printed_at = ${status === 'printed' ? 'NOW()' : 'printed_at'} WHERE id = ?`,
      [status, error_message || null, id]
    );

    const updated = await db.get('SELECT * FROM print_jobs WHERE id = ?', [id]);
    
    const io = req.app.get('io');
    if (io && updated) {
      io.emit('print_job_status_changed', updated);
    }

    res.json({ message: 'Status de impressão atualizado.', job: updated });
  } catch (error) {
    console.error('Erro ao atualizar status do trabalho de impressão:', error);
    res.status(500).json({ message: 'Erro ao atualizar status.' });
  }
}

export async function reprintJob(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const job = await db.get('SELECT * FROM print_jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ message: 'Trabalho de impressão não encontrado.' });
    }

    await db.run(
      "UPDATE print_jobs SET status = 'pending', error_message = NULL, created_at = NOW() WHERE id = ?",
      [id]
    );

    const updated = await db.get('SELECT * FROM print_jobs WHERE id = ?', [id]);
    let items = [];
    try {
      items = typeof updated.items_json === 'string' ? JSON.parse(updated.items_json) : updated.items_json;
    } catch(e) {}
    
    const jobData = { ...updated, items };

    const io = req.app.get('io');
    if (io) {
      io.emit('new_print_job', jobData);
    }

    res.json({ message: 'Impressão reenviada para a fila.', job: jobData });
  } catch (error) {
    console.error('Erro ao reenviar impressão:', error);
    res.status(500).json({ message: 'Erro ao reenviar trabalho de impressão.' });
  }
}
