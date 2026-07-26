const crypto = require('crypto');
const readline = require('readline');

const PALAVRA_SECRETA = 'MenuChefTopSeguro2024';

function gerarChave(cnpj, mesAno, dias, modulo) {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const moduloNormalizado = (modulo || 'BASICO').toUpperCase();
  const misturada = `${cnpjLimpo}-${mesAno}-${dias}-${moduloNormalizado}-${PALAVRA_SECRETA}`;
  const hash = crypto.createHash('md5').update(misturada).digest('hex');
  const chave12 = hash.substring(0, 12).toUpperCase();
  return `${chave12.substring(0, 4)}-${chave12.substring(4, 8)}-${chave12.substring(8, 12)}`;
}

function getMesAnoAtual() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  return `${mes}/${ano}`;
}

// Remove códigos ANSI para medir o tamanho REAL (visível) de uma string
function visibleLen(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

// Desenha uma caixa completa (topo, linhas centralizadas, base) com largura consistente
function desenharCaixa(linhas, opts = {}) {
  const {
    corBorda = '\x1b[36m',
    padLateral = 1,     // espaços entre a borda e o conteúdo de cada lado
    align = 'center',   // 'center' ou 'left'
  } = opts;
  const R = '\x1b[0m';

  const maiorLinha = Math.max(...linhas.map(l => visibleLen(l)));
  const largura = maiorLinha + padLateral * 2;

  function linha(conteudo = '') {
    const tamanhoVisivel = visibleLen(conteudo);
    const espacoTotal = largura - tamanhoVisivel;
    let esq, dir;
    if (align === 'center') {
      esq = Math.floor(espacoTotal / 2);
      dir = espacoTotal - esq;
    } else {
      esq = padLateral;
      dir = espacoTotal - esq;
    }
    console.log(`  ${corBorda}║${R}${' '.repeat(esq)}${conteudo}${' '.repeat(Math.max(0, dir))}${corBorda}║${R}`);
  }

  console.log(`  ${corBorda}╔${'═'.repeat(largura)}╗${R}`);
  linhas.forEach(l => linha(l));
  console.log(`  ${corBorda}╚${'═'.repeat(largura)}╝${R}`);
}

function mostrarHeader() {
  console.clear();
  console.log('');

  const C = '\x1b[36m';
  const LOGO = '\x1b[33m';
  const GRN = '\x1b[1;32m';
  const PUR = '\x1b[35m';
  const R = '\x1b[0m';

  const logoLines = [
    '███╗   ███╗███████╗██╗   ██╗     ██████╗██╗  ██╗███████╗███████╗',
    '████╗ ████║██╔════╝██║   ██║    ██╔════╝██║  ██║██╔════╝██╔════╝',
    '██╔████╔██║█████╗  ██║   ██║    ██║     ███████║█████╗  █████╗  ',
    '██║╚██╔╝██║██╔══╝  ██║   ██║    ██║     ██╔══██║██╔══╝  ██╔══╝  ',
    '██║ ╚═╝ ██║███████╗╚██████╔╝    ╚██████╗██║  ██║███████╗██║     ',
    '╚═╝     ╚═╝╚══════╝ ╚═════╝      ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝     ',
  ];

  const conteudo = [
    '',
    ...logoLines.map(l => `${LOGO}${l}${R}`),
    '',
    `${GRN}=> SECURITY KEY GENERATOR MODULE <=${R}`,
    `${PUR}MenuChef v1.3 [OFFLINE]${R}`,
    '',
  ];

  desenharCaixa(conteudo, { corBorda: C, padLateral: 2, align: 'center' });
  console.log('');
}

function mostrarMenuDias() {
  console.log('  \x1b[1mSelecione o tempo de uso da licenca:\x1b[0m');
  console.log('');
  console.log('    \x1b[33m[1]\x1b[0m  10 dias de uso');
  console.log('    \x1b[33m[2]\x1b[0m  15 dias de uso');
  console.log('    \x1b[33m[3]\x1b[0m  30 dias de uso');
  console.log('');
}

function mostrarMenuModulo() {
  console.log('  \x1b[1mSelecione o modulo do plano:\x1b[0m');
  console.log('');
  console.log('    \x1b[34m[1]\x1b[0m  \x1b[1mBasico\x1b[0m   \x1b[90m— Pedidos, Cozinha, Caixa e Relatorios\x1b[0m');
  console.log('    \x1b[32m[2]\x1b[0m  \x1b[1mGeral\x1b[0m    \x1b[90m— Basico + Delivery\x1b[0m');
  console.log('');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mostrarHeader();

// 1) Pergunta o CNPJ primeiro
rl.question('  \x1b[36mDigite o CNPJ do cliente (somente numeros):\x1b[0m ', (cnpj) => {
  const cnpjLimpo = cnpj.trim().replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    console.log('');
    console.log('  \x1b[31mERRO: CNPJ invalido! O CNPJ deve ter 14 digitos.\x1b[0m');
    console.log('');
    rl.close();
    return;
  }

  // 2) Menu de dias
  console.log('');
  mostrarMenuDias();

  rl.question('  \x1b[36mEscolha a opcao de dias (1, 2 ou 3):\x1b[0m ', (opcaoDias) => {
    const opcaoDiasLimpa = opcaoDias.trim();

    const opcoesDias = { '1': 10, '2': 15, '3': 30 };
    const dias = opcoesDias[opcaoDiasLimpa];

    if (!dias) {
      console.log('');
      console.log('  \x1b[31mERRO: Opcao invalida! Escolha 1, 2 ou 3.\x1b[0m');
      console.log('');
      rl.close();
      return;
    }

    // 3) Menu de módulo
    console.log('');
    mostrarMenuModulo();

    rl.question('  \x1b[36mEscolha o modulo (1 = Basico, 2 = Geral):\x1b[0m ', (opcaoModulo) => {
      const opcaoModuloLimpa = opcaoModulo.trim();

      const opcoesModulo = { '1': 'BASICO', '2': 'GERAL' };
      const modulo = opcoesModulo[opcaoModuloLimpa];

      if (!modulo) {
        console.log('');
        console.log('  \x1b[31mERRO: Opcao invalida! Escolha 1 (Basico) ou 2 (Geral).\x1b[0m');
        console.log('');
        rl.close();
        return;
      }

      const mesAno = getMesAnoAtual();
      const chave = gerarChave(cnpjLimpo, mesAno, dias, modulo);
      const cnpjFormatado = cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

      const dataAtual = new Date();
      dataAtual.setDate(dataAtual.getDate() + dias);
      const dataVencimento = dataAtual.toLocaleDateString('pt-BR');

      const VD = '\x1b[32m';
      const R = '\x1b[0m';
      const B = '\x1b[1m';
      const AM = '\x1b[1;33m';
      const DEST = '\x1b[1;44m';
      const COR_MODULO = modulo === 'GERAL' ? '\x1b[1;32m' : '\x1b[1;34m';

      console.log('');
      desenharCaixa(
        [
          `${B}${VD}CHAVE GERADA COM SUCESSO!${R}`,
          '',
          `CNPJ:      ${B}${cnpjFormatado}${R}`,
          `Mes/Ano:   ${B}${mesAno}${R}`,
          `Validade:  ${AM}${dias} dias${R} (ate ${dataVencimento})`,
          `Modulo:    ${COR_MODULO}${modulo}${R}`,
          '',
          `${DEST} CHAVE: ${chave} ${R}`,
        ],
        { corBorda: VD, padLateral: 3, align: 'center' }
      );
      console.log('');
      console.log('  \x1b[90mEnvie esta chave ao cliente para ativar no painel.\x1b[0m');
      console.log('');

      rl.close();
    });
  });
});