import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.env.DATABASE_FILE || '../database/restaurante.sqlite');
const dbDir = path.dirname(dbPath);
const licencaPath = path.join(dbDir, 'licenca.json');

function getLicenca() {
  if (!fs.existsSync(licencaPath)) {
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 7);
    const licencaPadrao = {
      vencimento: dataVencimento.toISOString(),
      emergenciaUsadaEsteMes: '',
      chaveAtual: '',
      modulo: 'BASICO'
    };
    fs.writeFileSync(licencaPath, JSON.stringify(licencaPadrao, null, 2), 'utf8');
    return licencaPadrao;
  }
  const licenca = JSON.parse(fs.readFileSync(licencaPath, 'utf-8'));
  // Garante campo modulo em licenças antigas
  if (!licenca.modulo) licenca.modulo = 'BASICO';
  return licenca;
}

function salvarLicenca(licenca) {
  fs.writeFileSync(licencaPath, JSON.stringify(licenca, null, 2), 'utf8');
}

/**
 * Middleware que verifica se a licença do sistema está válida.
 * Bloqueia rotas de pedidos e caixa quando vencida.
 * NÃO bloqueia: auth, loja (GET), license (ativas), device-ip
 */
export function checkLicense(req, res, next) {
  try {
    const licenca = getLicenca();
    const dataVencimento = new Date(licenca.vencimento);
    const hoje = new Date();

    if (hoje > dataVencimento) {
      return res.status(402).json({
        error: 'Sua licença venceu! Insira uma nova chave para liberar o sistema.',
        bloqueado: true,
        vencimento: licenca.vencimento
      });
    }

    req.licenca = licenca;
    next();
  } catch (error) {
    console.error('Erro ao verificar licença:', error);
    next();
  }
}

/**
 * Middleware de módulo: bloqueia rotas do Delivery para licenças BASICO.
 * Deve ser usado após checkLicense.
 */
export function checkModuloGeral(req, res, next) {
  try {
    const licenca = getLicenca();
    const modulo = (licenca.modulo || 'BASICO').toUpperCase();

    if (modulo !== 'GERAL') {
      return res.status(403).json({
        error: 'O módulo Delivery não está disponível no seu plano atual (Básico). Ative uma licença do plano Geral.',
        modulo
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar módulo da licença:', error);
    next();
  }
}

export { getLicenca, salvarLicenca, licencaPath };
