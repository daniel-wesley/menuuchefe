import { db } from '../config/db.js';

async function getLicenca() {
  try {
    const row = await db.get('SELECT * FROM licenses WHERE id = 1');
    if (row) {
      return {
        vencimento: row.vencimento,
        emergenciaUsadaEsteMes: row.emergencia_usada_este_mes || '',
        chaveAtual: row.chave_atual || '',
        diasLicenciados: row.dias_licenciados || 0,
        modulo: row.modulo || 'BASICO'
      };
    }
    console.warn('[Licença] Nenhum registro encontrado na tabela licenses (id=1). Usando padrão de 7 dias.');
  } catch (err) {
    console.error('[Licença] Erro ao ler licença do banco:', err.message);
  }

  // Fallback: retorna licença padrão de 7 dias
  const dataVencimento = new Date();
  dataVencimento.setDate(dataVencimento.getDate() + 7);
  return {
    vencimento: dataVencimento.toISOString(),
    emergenciaUsadaEsteMes: '',
    chaveAtual: '',
    diasLicenciados: 0,
    modulo: 'BASICO'
  };
}

async function salvarLicenca(licenca) {
  try {
    await db.run(
      `INSERT INTO licenses (id, vencimento, emergencia_usada_este_mes, chave_atual, dias_licenciados, modulo)
       VALUES (1, $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET vencimento=$1, emergencia_usada_este_mes=$2, chave_atual=$3, dias_licenciados=$4, modulo=$5`,
      [licenca.vencimento, licenca.emergenciaUsadaEsteMes || '', licenca.chaveAtual || '', licenca.diasLicenciados || 0, licenca.modulo || 'BASICO']
    );
    console.log('[Licença] Salva com sucesso no banco. Vencimento:', licenca.vencimento, '| Módulo:', licenca.modulo);
  } catch (err) {
    console.error('[Licença] ERRO ao salvar licença no banco:', err.message);
    throw err; // Propagar o erro para que o controller saiba que falhou
  }
}

/**
 * Middleware que verifica se a licença do sistema está válida.
 * Bloqueia rotas de pedidos e caixa quando vencida.
 */
export async function checkLicense(req, res, next) {
  try {
    const licenca = await getLicenca();
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
 */
export async function checkModuloGeral(req, res, next) {
  try {
    const licenca = await getLicenca();
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

export { getLicenca, salvarLicenca };
