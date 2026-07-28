import path from 'path';
import fs from 'fs';
import { gerarChaveMensal, validarChave } from '../utils/keygen.js';
import { getLicenca, salvarLicenca } from '../middleware/checkLicense.js';
import { db } from '../config/db.js';

const dbPath = path.resolve(process.env.DATABASE_FILE || '../database/restaurante.sqlite');
const dbDir = path.dirname(dbPath);
const lojaJsonPath = path.join(dbDir, 'loja.json');

function getCnpj() {
  if (!fs.existsSync(lojaJsonPath)) return '';
  const loja = JSON.parse(fs.readFileSync(lojaJsonPath, 'utf-8'));
  return loja.cnpj || '';
}

function getMesAnoAtual() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  return `${mes}/${ano}`;
}

/**
 * GET /api/license/status
 * Retorna o status atual da licença
 */
export async function getLicenseStatus(req, res) {
  try {
    const licenca = await getLicenca();
    const hoje = new Date();
    const dataVencimento = new Date(licenca.vencimento);
    const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

    res.json({
      vencimento: licenca.vencimento,
      diasRestantes: Math.max(0, diasRestantes),
      bloqueado: hoje > dataVencimento,
      chaveAtual: licenca.chaveAtual || '',
      diasLicenciados: licenca.diasLicenciados || 0,
      emergenciaUsadaEsteMes: licenca.emergenciaUsadaEsteMes || '',
      modulo: licenca.modulo || 'BASICO'
    });
  } catch (error) {
    console.error('Erro ao verificar status da licença:', error);
    res.status(500).json({ message: 'Erro ao verificar licença.' });
  }
}

/**
 * POST /api/license/activate
 * Ativa o sistema com uma chave fornecida
 */
export async function activateLicense(req, res) {
  try {
    const { chave } = req.body;

    if (!chave || chave.trim().length < 10) {
      return res.status(400).json({ message: 'Forneça uma chave válida no formato XXXX-XXXX-XXXX.' });
    }

    const cnpj = getCnpj();
    if (!cnpj) {
      return res.status(400).json({ message: 'CNPJ não configurado. Cadastre os dados da loja primeiro.' });
    }

    const mesAno = getMesAnoAtual();
    const palavraSecreta = process.env.LICENSE_SECRET || 'MenuChefTopSeguro2024';

    const resultado = validarChave(chave, cnpj, mesAno, palavraSecreta);
    if (!resultado.valida) {
      return res.status(400).json({ message: 'Chave inválida ou não corresponde ao mês atual.' });
    }

    const licenca = await getLicenca();
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + resultado.dias);

    licenca.vencimento = novaData.toISOString();
    licenca.chaveAtual = chave.toUpperCase().trim();
    licenca.diasLicenciados = resultado.dias;
    licenca.modulo = resultado.modulo || 'BASICO';
    licenca.emergenciaUsadaEsteMes = '';
    await salvarLicenca(licenca);

    const diasRestantes = Math.ceil((novaData - new Date()) / (1000 * 60 * 60 * 24));

    res.json({
      message: 'Licença ativada com sucesso!',
      vencimento: licenca.vencimento,
      diasRestantes
    });
  } catch (error) {
    console.error('Erro ao ativar licença:', error);
    res.status(500).json({ message: 'Erro ao ativar licença.' });
  }
}

/**
 * POST /api/license/emergency
 * Libera prazo de emergência (+3 dias, 1 vez por mês)
 */
export async function emergencyExtension(req, res) {
  try {
    const licenca = await getLicenca();
    const hoje = new Date();
    const mesAtual = `${hoje.getMonth() + 1}/${hoje.getFullYear()}`;

    if (licenca.emergenciaUsadaEsteMes === mesAtual) {
      return res.status(400).json({
        message: 'O prazo de emergência já foi utilizado este mês. Aguarde o próximo mês ou insira uma nova chave.',
        bloqueado: true
      });
    }

    const dataVencimento = new Date(licenca.vencimento);
    dataVencimento.setDate(dataVencimento.getDate() + 3);

    licenca.vencimento = dataVencimento.toISOString();
    licenca.emergenciaUsadaEsteMes = mesAtual;
    await salvarLicenca(licenca);

    const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

    res.json({
      message: 'Prazo de emergência liberado! +3 dias adicionados.',
      vencimento: licenca.vencimento,
      diasRestantes
    });
  } catch (error) {
    console.error('Erro ao liberar emergência:', error);
    res.status(500).json({ message: 'Erro ao liberar prazo de emergência.' });
  }
}

/**
 * POST /api/license/generate
 * Gera uma chave para um mês específico (apenas para o admin dono)
 */
export async function generateKey(req, res) {
  try {
    const { mesAno, dias, modulo } = req.body;

    const cnpj = getCnpj();
    if (!cnpj) {
      return res.status(400).json({ message: 'CNPJ não configurado. Cadastre os dados da loja primeiro.' });
    }

    const palavraSecreta = process.env.LICENSE_SECRET || 'MenuChefTopSeguro2024';
    const mesAlvo = mesAno || getMesAnoAtual();
    const diasAlvo = dias || 30;
    const moduloAlvo = (modulo || 'BASICO').toUpperCase();

    const chave = gerarChaveMensal(cnpj, mesAlvo, diasAlvo, moduloAlvo, palavraSecreta);

    res.json({
      chave,
      cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
      mesAno: mesAlvo,
      dias: diasAlvo,
      modulo: moduloAlvo
    });
  } catch (error) {
    console.error('Erro ao gerar chave:', error);
    res.status(500).json({ message: 'Erro ao gerar chave.' });
  }
}
