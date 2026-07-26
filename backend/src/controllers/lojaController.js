import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.env.DATABASE_FILE || '../database/restaurante.sqlite');
const dbDir = path.dirname(dbPath);
const lojaJsonPath = path.join(dbDir, 'loja.json');

export async function getLoja(req, res) {
  try {
    if (!fs.existsSync(lojaJsonPath)) {
      return res.json({
        nome_fantasia: '',
        telefone: '',
        cnpj: '',
        ie: '',
        endereco: ''
      });
    }
    const rawData = fs.readFileSync(lojaJsonPath, 'utf8');
    const data = JSON.parse(rawData);
    res.json(data);
  } catch (error) {
    console.error('Erro ao ler dados da loja:', error);
    res.status(500).json({ message: 'Erro ao carregar dados da empresa.' });
  }
}

export async function updateLoja(req, res) {
  try {
    const { nome_fantasia, telefone, cnpj, ie, endereco } = req.body;
    
    const storeData = {
      nome_fantasia: nome_fantasia || '',
      telefone: telefone || '',
      cnpj: cnpj || '',
      ie: ie || '',
      endereco: endereco || ''
    };

    // Garante que o diretório do banco/JSON existe
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    fs.writeFileSync(lojaJsonPath, JSON.stringify(storeData, null, 2), 'utf8');
    res.json({ message: 'Dados da empresa salvos com sucesso!', data: storeData });
  } catch (error) {
    console.error('Erro ao salvar dados da loja:', error);
    res.status(500).json({ message: 'Erro ao salvar dados da empresa.' });
  }
}
