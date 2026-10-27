// Utilitário para Impressão Térmica de DAV e Pedidos (Bobina 80mm / 58mm)
// Otimizado para alta legibilidade (Courier New / Monospace, alto contraste, sem dithering)
// e controle exato de avanço de papel evitando páginas extras em branco.

export const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const getPaymentLabel = (methodId) => {
  const map = {
    dinheiro: 'Dinheiro',
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito',
    pix: 'Pix',
    voucher: 'Voucher / Refeição'
  };
  return map[methodId] || (methodId ? methodId.toUpperCase() : 'Outro');
};

/**
 * Gera o documento HTML do DAV pronto para envio à impressora térmica.
 * @param {Object} params
 * @param {Object} params.receiptData - Dados da venda / pedido
 * @param {Object} params.lojaInfo - Dados da empresa / estabelecimento
 * @param {'80mm'|'58mm'} [params.paperWidth='80mm'] - Largura da bobina
 * @param {number|null} [params.cutSpacingMm=null] - Avanço de corte em milímetros
 */
export function generateDavReceiptHtml({
  receiptData,
  lojaInfo = {},
  paperWidth = '80mm',
  cutSpacingMm = null
}) {
  const is58mm = paperWidth === '58mm';
  // 80mm printable width = ~72mm; 58mm printable width = ~48mm
  const printWidthMm = is58mm ? 48 : 72;
  // No 58mm usamos 10px e line-height compacto para evitar salto de página
  const baseFontSize = is58mm ? '10px' : '12px';
  const headerFontSize = is58mm ? '12px' : '15px';
  const totalFontSize = is58mm ? '13px' : '16px';
  const lineHeight = is58mm ? '1.18' : '1.25';
  const actualCutSpacingMm = cutSpacingMm !== null ? cutSpacingMm : (is58mm ? 14 : 20);

  const totalItemsCount = (receiptData.orders || []).reduce(
    (acc, o) => acc + (o.items || []).reduce((a, i) => a + (i.quantity || 1), 0),
    0
  );

  const totalPaid = (receiptData.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const changeAmount = Math.max(0, totalPaid - (receiptData.total || 0));

  // Renderização de cada item vendido (sem truncar nomes!)
  let itemIndex = 1;
  const itemsHtml = (receiptData.orders || [])
    .flatMap((order) =>
      (order.items || []).map((item) => {
        const idx = itemIndex++;
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        return `
          <div style="margin-bottom: ${is58mm ? '2.5px' : '4px'};">
            <div style="font-weight: 700; word-break: break-word; line-height: 1.15;">
              ${String(idx).padStart(2, '0')} ${escapeHtml(item.name || 'ITEM')}
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: ${is58mm ? '10px' : '0.95em'}; padding-left: ${is58mm ? '6px' : '12px'}; margin-top: 1px;">
              <span>${item.quantity}x R$ ${formatCurrency(item.price)}</span>
              <span>R$ ${formatCurrency(itemTotal)}</span>
            </div>
            ${item.notes ? `<div style="font-size: 0.85em; font-style: italic; padding-left: ${is58mm ? '6px' : '12px'}; color: #000; margin-top: 1px;">Obs: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        `;
      })
    )
    .join('');

  // Renderização de pagamentos
  const paymentsHtml = (receiptData.payments || [])
    .map(
      (p) => `
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>${getPaymentLabel(p.method)}:</span>
          <span>R$ ${formatCurrency(p.amount)}</span>
        </div>
      `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DAV - Documento Auxiliar de Venda</title>
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: auto;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${baseFontSize};
      line-height: ${lineHeight};
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    .receipt-container {
      width: ${printWidthMm}mm;
      max-width: ${printWidthMm}mm;
      margin: 0 auto;
      /* O avanço de corte é inserido diretamente no padding inferior da área do cupom */
      padding: ${is58mm ? '1mm 0.5mm' : '2mm 1mm'} ${actualCutSpacingMm}mm ${is58mm ? '0.5mm' : '1mm'};
      color: #000000;
      background: #ffffff;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: ${is58mm ? '2.5px 0' : '4px 0'};
      width: 100%;
    }
    .divider-solid {
      border-top: 2px solid #000000;
      margin: ${is58mm ? '3px 0' : '5px 0'};
      width: 100%;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: 700; }
    .black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .flex-between {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- CABEÇALHO DA EMPRESA -->
    <div class="text-center">
      <div style="font-size: ${headerFontSize}; font-weight: 900; line-height: 1.15;" class="uppercase">
        ${escapeHtml(lojaInfo.nome_fantasia || '*** MENU CHEF ***')}
      </div>
      ${lojaInfo.cnpj ? `<div style="font-size: 0.9em; font-weight: 700; margin-top: 1px;">CNPJ: ${escapeHtml(lojaInfo.cnpj)}</div>` : ''}
      ${lojaInfo.ie ? `<div style="font-size: 0.9em; font-weight: 700;">IE: ${escapeHtml(lojaInfo.ie)}</div>` : ''}
      ${lojaInfo.endereco ? `<div style="font-size: 0.85em; font-weight: 700; margin-top: 1px; line-height: 1.15;">${escapeHtml(lojaInfo.endereco)}</div>` : ''}
      ${lojaInfo.telefone ? `<div style="font-size: 0.9em; font-weight: 700;">TEL: ${escapeHtml(lojaInfo.telefone)}</div>` : ''}
    </div>

    <!-- TÍTULO DAV -->
    <div class="text-center" style="margin-top: ${is58mm ? '3px' : '5px'};">
      <div style="font-size: ${headerFontSize}; font-weight: 900; letter-spacing: 2px;">D A V</div>
      <div style="font-size: 0.9em; font-weight: 700;">Documento Auxiliar de Venda</div>
    </div>

    <div class="divider"></div>
    <div class="text-center bold" style="font-size: 0.9em; letter-spacing: 0.5px;">
      NÃO TEM VALOR FISCAL
    </div>
    <div class="divider"></div>

    <!-- DADOS DA VENDA -->
    <div style="font-size: 0.95em;">
      <div class="flex-between">
        <span class="bold">DAV Nº:</span>
        <span class="black" style="font-size: 1.1em;">${receiptData.dav_number || '00001'}</span>
      </div>
      <div class="flex-between">
        <span class="bold">Data/Hora:</span>
        <span class="bold">${receiptData.date || new Date().toLocaleString('pt-BR')}</span>
      </div>
      <div class="flex-between">
        <span class="bold">Terminal:</span>
        <span class="bold">001</span>
      </div>
      ${receiptData.table_number ? `
      <div class="flex-between">
        <span class="bold">Mesa:</span>
        <span class="black">Mesa ${receiptData.table_number}</span>
      </div>` : ''}
      ${receiptData.client_cpf ? `
      <div class="flex-between">
        <span class="bold">CPF Cliente:</span>
        <span class="bold">${escapeHtml(receiptData.client_cpf)}</span>
      </div>` : ''}
    </div>

    <!-- CABEÇALHO DE ITENS -->
    <div class="divider"></div>
    <div class="flex-between bold uppercase" style="font-size: 0.9em;">
      <span>ITEM DESCRIÇÃO</span>
      <span>QTD  TOTAL</span>
    </div>
    <div class="divider"></div>

    <!-- LISTA DE ITENS -->
    <div style="margin: 2px 0;">
      ${itemsHtml}
    </div>

    <!-- TOTALIZADORES -->
    <div class="divider"></div>
    <div style="font-size: 0.95em;">
      <div class="flex-between bold">
        <span>Subtotal:</span>
        <span>R$ ${formatCurrency(receiptData.subtotal)}</span>
      </div>
      ${receiptData.service_charge > 0 ? `
      <div class="flex-between bold">
        <span>Acréscimos (10%):</span>
        <span>R$ ${formatCurrency(receiptData.service_charge)}</span>
      </div>` : ''}
      <div class="divider-solid"></div>
      <div class="flex-between black" style="font-size: ${totalFontSize}; padding: 1px 0;">
        <span>VALOR À PAGAR:</span>
        <span>R$ ${formatCurrency(receiptData.total)}</span>
      </div>
      <div class="divider-solid"></div>
      ${receiptData.split_count > 1 ? `
      <div class="flex-between bold" style="font-size: 0.9em; margin-top: 1px;">
        <span>Por pessoa (${receiptData.split_count}x):</span>
        <span>R$ ${formatCurrency(receiptData.total / receiptData.split_count)}</span>
      </div>` : ''}
    </div>

    <!-- PAGAMENTOS -->
    <div class="divider"></div>
    <div class="bold uppercase" style="font-size: 0.9em; margin-bottom: 1px;">FORMA DE PAGAMENTO:</div>
    <div style="font-size: 0.95em;">
      ${paymentsHtml}
      ${changeAmount > 0 ? `
      <div class="flex-between black" style="margin-top: 1px; font-size: 1.05em;">
        <span>TROCO:</span>
        <span>R$ ${formatCurrency(changeAmount)}</span>
      </div>` : ''}
    </div>

    <!-- TOTAL DE ITENS -->
    <div class="divider"></div>
    <div class="text-center bold" style="font-size: 0.9em;">
      Qtd. Total de Itens: ${totalItemsCount}
    </div>

    <!-- AVISO FISCAL -->
    <div class="divider"></div>
    <div class="text-center bold uppercase" style="font-size: 0.85em; padding: 1px 0;">
      *** NÃO É VÁLIDO COMO CUPOM FISCAL ***
    </div>
    <div class="divider"></div>

    <!-- RODAPÉ -->
    <div class="text-center bold uppercase" style="font-size: 0.9em; line-height: 1.25; margin-top: 2px;">
      <div>Obrigado pela preferência!</div>
      <div>Volte Sempre!</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Imprime um documento HTML em iframe isolado garantindo que Chrome/Windows não adicione cabeçalhos,
 * e respeitando estritamente a altura do documento sem páginas extras.
 */
export function printHtmlViaIframe(htmlContent) {
  return new Promise((resolve, reject) => {
    try {
      // Remove iframe residual se existir
      const oldFrame = document.getElementById('thermal-silent-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'thermal-silent-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve(true);
        } catch (err) {
          console.error('Falha ao acionar print no iframe:', err);
          reject(err);
        } finally {
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 3000);
        }
      }, 350);
    } catch (e) {
      console.error('Erro na criação do iframe de impressão:', e);
      reject(e);
    }
  });
}

/**
 * Função principal para disparar a impressão do DAV
 */
export async function printDavReceipt({
  receiptData,
  lojaInfo = {},
  paperWidth = '80mm',
  cutSpacingMm = null
}) {
  const html = generateDavReceiptHtml({
    receiptData,
    lojaInfo,
    paperWidth,
    cutSpacingMm
  });
  return printHtmlViaIframe(html);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
