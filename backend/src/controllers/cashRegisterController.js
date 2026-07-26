import { getDbConnection } from '../config/db.js';

/**
 * GET /api/cash-register/status
 * Returns the current open cash register session (if any).
 */
export async function getCashRegisterStatus(req, res) {
  try {
    const db = await getDbConnection();
    const session = await db.get(
      `SELECT * FROM cash_registers WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );
    return res.json({ session: session || null });
  } catch (err) {
    console.error('getCashRegisterStatus error:', err);
    return res.status(500).json({ message: 'Erro interno ao verificar status do caixa.' });
  }
}

/**
 * POST /api/cash-register/open
 * Opens a new cash register session.
 * Body: { initial_amount: number, operator_name: string }
 */
export async function openCashRegister(req, res) {
  try {
    const db = await getDbConnection();

    // Check if there's already an open session
    const existing = await db.get(
      `SELECT id FROM cash_registers WHERE closed_at IS NULL LIMIT 1`
    );
    if (existing) {
      return res.status(400).json({ message: 'O caixa já está aberto. Feche o caixa atual antes de abrir um novo.' });
    }

    const { initial_amount, operator_name } = req.body;
    if (initial_amount === undefined || initial_amount === null || isNaN(Number(initial_amount))) {
      return res.status(400).json({ message: 'Informe o valor do fundo de caixa.' });
    }

    const result = await db.run(
      `INSERT INTO cash_registers (operator_name, initial_amount, opened_at) VALUES (?, ?, NOW()) RETURNING id`,
      [operator_name || req.user?.name || 'Operador', Number(initial_amount)]
    );

    const session = await db.get(`SELECT * FROM cash_registers WHERE id = ?`, [result.lastID]);
    return res.status(201).json({ message: 'Caixa aberto com sucesso!', session });
  } catch (err) {
    console.error('openCashRegister error:', err);
    return res.status(500).json({ message: 'Erro interno ao abrir o caixa.' });
  }
}

/**
 * POST /api/cash-register/close
 * Closes the current open cash register session.
 * Blocks if there are any occupied tables.
 */
export async function closeCashRegister(req, res) {
  try {
    const db = await getDbConnection();

    // Check for open session
    const session = await db.get(
      `SELECT * FROM cash_registers WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );
    if (!session) {
      return res.status(400).json({ message: 'Nenhum caixa aberto para fechar.' });
    }

    // Block if there are occupied tables
    const occupiedTables = await db.all(
      `SELECT number FROM tables WHERE status != 'free'`
    );
    if (occupiedTables.length > 0) {
      const tableNumbers = occupiedTables.map(t => t.number).join(', ');
      return res.status(400).json({
        message: `Não é possível fechar o caixa. As seguintes mesas ainda estão abertas: Mesa(s) ${tableNumbers}. Finalize ou cancele todos os atendimentos antes de fechar o caixa.`,
        occupied_tables: occupiedTables
      });
    }

    // Calculate total revenue during this session
    const revenueData = await db.get(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_transactions 
       FROM transactions 
       WHERE created_at >= ?`,
      [session.opened_at]
    );

    // Get revenue breakdown by payment method
    const paymentBreakdown = await db.all(
      `SELECT payment_method, COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
       FROM transactions 
       WHERE created_at >= ?
       GROUP BY payment_method`,
      [session.opened_at]
    );

    // Calculate total withdrawals (sangrias) during this session
    const withdrawalData = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total_withdrawals 
       FROM cash_withdrawals 
       WHERE cash_register_id = ?`,
      [session.id]
    );

    const closingAmount = revenueData.total_revenue + session.initial_amount - withdrawalData.total_withdrawals;

    // Close the session
    await db.run(
      `UPDATE cash_registers 
       SET closed_at = NOW(), 
           final_amount = ?, 
           total_revenue = ?,
           total_transactions = ?
       WHERE id = ?`,
      [closingAmount, revenueData.total_revenue, revenueData.total_transactions, session.id]
    );

    const closedSession = await db.get(`SELECT * FROM cash_registers WHERE id = ?`, [session.id]);

    return res.json({
      message: 'Caixa fechado com sucesso!',
      session: closedSession,
      summary: {
        initial_amount: session.initial_amount,
        total_revenue: revenueData.total_revenue,
        total_transactions: revenueData.total_transactions,
        total_withdrawals: withdrawalData.total_withdrawals,
        final_amount: closingAmount,
        payment_breakdown: paymentBreakdown
      }
    });
  } catch (err) {
    console.error('closeCashRegister error:', err);
    return res.status(500).json({ message: 'Erro interno ao fechar o caixa.' });
  }
}

/**
 * POST /api/cash-register/withdrawal
 * Registers a cash withdrawal (sangria) from the current open session.
 * Body: { amount: number, reason: string }
 */
export async function withdrawCash(req, res) {
  try {
    const db = await getDbConnection();

    const session = await db.get(
      `SELECT * FROM cash_registers WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );
    if (!session) {
      return res.status(400).json({ message: 'Nenhum caixa aberto para registrar sangria.' });
    }

    const { amount, reason } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Informe um valor válido para a sangria.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Informe o motivo da sangria.' });
    }

    const operatorName = req.user?.name || req.user?.username || 'Operador';

    await db.run(
      `INSERT INTO cash_withdrawals (cash_register_id, amount, reason, operator_name) VALUES (?, ?, ?, ?)`,
      [session.id, Number(amount), reason.trim(), operatorName]
    );

    const totalWithdrawals = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_withdrawals WHERE cash_register_id = ?`,
      [session.id]
    );

    return res.status(201).json({
      message: 'Sangria registrada com sucesso!',
      total_withdrawals: totalWithdrawals.total
    });
  } catch (err) {
    console.error('withdrawCash error:', err);
    return res.status(500).json({ message: 'Erro interno ao registrar sangria.' });
  }
}

/**
 * GET /api/cash-register/withdrawals
 * Returns all withdrawals for the current open session.
 */
export async function getWithdrawals(req, res) {
  try {
    const db = await getDbConnection();

    const session = await db.get(
      `SELECT id FROM cash_registers WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );
    if (!session) {
      return res.json({ withdrawals: [], total: 0 });
    }

    const withdrawals = await db.all(
      `SELECT * FROM cash_withdrawals WHERE cash_register_id = ? ORDER BY created_at DESC`,
      [session.id]
    );

    const totalResult = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_withdrawals WHERE cash_register_id = ?`,
      [session.id]
    );

    return res.json({ withdrawals, total: totalResult.total });
  } catch (err) {
    console.error('getWithdrawals error:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar sangrias.' });
  }
}

/**
 * GET /api/cash-register/history
 * Returns the last 30 cash register sessions.
 */
export async function getCashRegisterHistory(req, res) {
  try {
    const db = await getDbConnection();
    const history = await db.all(
      `SELECT * FROM cash_registers ORDER BY opened_at DESC LIMIT 30`
    );
    return res.json({ history });
  } catch (err) {
    console.error('getCashRegisterHistory error:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar histórico do caixa.' });
  }
}
