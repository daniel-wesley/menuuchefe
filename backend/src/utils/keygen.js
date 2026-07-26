import crypto from 'crypto';

/**
 * Gera uma chave de licença mensal de 12 dígitos no formato XXXX-XXXX-XXXX
 * Baseada no CNPJ + Mês/Ano + Dias + Módulo + Palavra Secreta
 */
export function gerarChaveMensal(cnpj, mesAno, dias, modulo, palavraSecreta) {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const moduloNormalizado = (modulo || 'BASICO').toUpperCase();
  const misturada = `${cnpjLimpo}-${mesAno}-${dias}-${moduloNormalizado}-${palavraSecreta}`;

  const hash = crypto.createHash('md5').update(misturada).digest('hex');

  const chave12 = hash.substring(0, 12).toUpperCase();

  return `${chave12.substring(0, 4)}-${chave12.substring(4, 8)}-${chave12.substring(8, 12)}`;
}

/**
 * Valida se uma chave fornecida corresponde ao CNPJ + Mês/Ano corretos.
 * Testa automaticamente as 6 combinações possíveis:
 *   dias:    [10, 15, 30]
 *   modulos: ['BASICO', 'GERAL']
 * Retorna { valida, dias, modulo }
 */
export function validarChave(chave, cnpj, mesAno, palavraSecreta) {
  const diasOpcoes = [10, 15, 30];
  const modulosOpcoes = ['BASICO', 'GERAL'];
  const chaveNormalizada = chave.toUpperCase().replace(/\s/g, '');

  for (const dias of diasOpcoes) {
    for (const modulo of modulosOpcoes) {
      const chaveGerada = gerarChaveMensal(cnpj, mesAno, dias, modulo, palavraSecreta);
      if (chaveNormalizada === chaveGerada) {
        return { valida: true, dias, modulo };
      }
    }
  }

  return { valida: false, dias: 0, modulo: null };
}
