import { getDbConnection } from '../config/db.js';

export async function getLoja(req, res) {
  try {
    const db = await getDbConnection();
    let loja = await db.get('SELECT * FROM loja ORDER BY id ASC LIMIT 1');
    if (!loja) {
      return res.json({
        nome_fantasia: '',
        telefone: '',
        cnpj: '',
        ie: '',
        endereco: '',
        printer_cupom: '',
        printer_cozinha: '',
        printer_bar: ''
      });
    }
    res.json(loja);
  } catch (error) {
    console.error('Erro ao ler dados da loja:', error);
    res.status(500).json({ message: 'Erro ao carregar dados da empresa.' });
  }
}

export async function updateLoja(req, res) {
  try {
    const { nome_fantasia, telefone, cnpj, ie, endereco, printer_cupom, printer_cozinha, printer_bar } = req.body;
    const db = await getDbConnection();

    let existing = await db.get('SELECT * FROM loja ORDER BY id ASC LIMIT 1');

    if (existing) {
      await db.run(
        `UPDATE loja SET 
          nome_fantasia = ?, 
          telefone = ?, 
          cnpj = ?, 
          ie = ?, 
          endereco = ?,
          printer_cupom = ?,
          printer_cozinha = ?,
          printer_bar = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          nome_fantasia || '',
          telefone || '',
          cnpj || '',
          ie || '',
          endereco || '',
          printer_cupom || '',
          printer_cozinha || '',
          printer_bar || '',
          existing.id
        ]
      );
    } else {
      await db.run(
        `INSERT INTO loja (nome_fantasia, telefone, cnpj, ie, endereco, printer_cupom, printer_cozinha, printer_bar)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nome_fantasia || '',
          telefone || '',
          cnpj || '',
          ie || '',
          endereco || '',
          printer_cupom || '',
          printer_cozinha || '',
          printer_bar || ''
        ]
      );
    }

    const updated = await db.get('SELECT * FROM loja ORDER BY id ASC LIMIT 1');
    res.json({ message: 'Dados da empresa salvos com sucesso!', data: updated });
  } catch (error) {
    console.error('Erro ao salvar dados da loja:', error);
    res.status(500).json({ message: 'Erro ao salvar dados da empresa.' });
  }
}

