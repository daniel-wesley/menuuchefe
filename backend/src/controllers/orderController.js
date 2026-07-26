import { getDbConnection } from '../config/db.js';

export async function createOrder(req, res) {
  const { table_id, client_name, items } = req.body;
  const user_id = req.user ? req.user.id : null; // Can be null if ordered by customer via QR Code

  if (!table_id || !items || !items.length) {
    return res.status(400).json({ message: 'Dados do pedido inválidos.' });
  }

  const db = await getDbConnection();

  try {
    // 1. Begin SQL Transaction
    await db.run('BEGIN TRANSACTION');

    // Verify table exists
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [table_id]);
    if (!table) {
      await db.run('ROLLBACK');
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    // Reject orders if table is in 'waiting_payment' state
    if (table.status === 'waiting_payment') {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: 'A mesa está aguardando pagamento. Por favor, reabra a mesa para lançar novos pedidos.' });
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    // Verify products, check stock, and calculate prices
    for (const item of items) {
      const product = await db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!product) {
        await db.run('ROLLBACK');
        return res.status(404).json({ message: `Produto ID ${item.product_id} não encontrado.` });
      }

      // Check stock if tracked
      if (product.track_stock === 1) {
        if (product.stock < item.quantity) {
          await db.run('ROLLBACK');
          return res.status(400).json({ 
            message: `Estoque insuficiente para o produto "${product.name}". Disponível: ${product.stock}, solicitado: ${item.quantity}.` 
          });
        }
        // Deduct stock
        await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      calculatedTotal += product.price * item.quantity;
      validatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        notes: item.notes || ''
      });
    }

    // 2. Insert Order
    const orderResult = await db.run(
      `INSERT INTO orders (table_id, user_id, client_name, status, total_amount, created_at, updated_at) 
       VALUES (?, ?, ?, 'received', ?, NOW(), NOW()) RETURNING id`,
      [table_id, user_id, client_name || null, calculatedTotal]
    );
    const orderId = orderResult.lastID;

    // 3. Insert Order Items
    for (const item of validatedItems) {
      await db.run(
        'INSERT INTO order_items (order_id, product_id, quantity, price, notes) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price, item.notes]
      );
    }

    // 4. Update Table status to 'occupied' if it was 'free'
    if (table.status === 'free') {
      await db.run('UPDATE tables SET status = \'occupied\' WHERE id = ?', [table_id]);
      table.status = 'occupied';
    }

    await db.run('COMMIT');

    // 5. Build full order response object
    const createdOrder = {
      id: orderId,
      table_id,
      table_number: table.number,
      user_id,
      client_name: client_name || null,
      status: 'received',
      total_amount: calculatedTotal,
      created_at: new Date().toISOString(),
      items: validatedItems
    };

    // 6. Broadcast Real-Time socket events
    const io = req.app.get('io');
    if (io) {
      // Emit to kitchen room and general receivers
      io.emit('order_received', createdOrder);
      io.emit('table_status_changed', { id: table_id, number: table.number, status: table.status, token: table.token });
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Erro ao registrar pedido.' });
  }
}

export async function getOrders(req, res) {
  const { status } = req.query;

  try {
    const db = await getDbConnection();
    let query = `
      SELECT o.*, t.number as table_number, u.name as waiter_name 
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.user_id = u.id
    `;
    const params = [];

    if (status) {
      // If status is a list of statuses, e.g. status=received,preparing
      const statuses = status.split(',');
      const placeholders = statuses.map(() => '?').join(',');
      query += ` WHERE o.status IN (${placeholders})`;
      params.push(...statuses);
    }

    query += ' ORDER BY o.created_at DESC';

    const orders = await db.all(query, params);

    // Fetch items for each order
    for (const order of orders) {
      order.items = await db.all(
        `SELECT oi.*, p.name as name, p.category as category 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [order.id]
      );
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Erro ao buscar pedidos.' });
  }
}

export async function getOrderById(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const order = await db.get(
      `SELECT o.*, t.number as table_number, u.name as waiter_name 
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    order.items = await db.all(
      `SELECT oi.*, p.name as name, p.category as category 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [id]
    );

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Erro ao buscar detalhes do pedido.' });
  }
}

export async function getActiveOrdersByTable(req, res) {
  const { tableNumber } = req.params;

  try {
    const db = await getDbConnection();
    
    // Find table
    const table = await db.get('SELECT * FROM tables WHERE number = ?', [tableNumber]);
    if (!table) {
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    // Fetch all orders for this table that are NOT delivered or still unpaid.
    // In our system, active orders on an occupied table are the ones that haven't been cleared by checkout transaction.
    // When checkout happens, the table status is set back to 'free' and orders are considered complete.
    // Let's fetch all orders associated with the table's current occupation.
    // In a simple design, we fetch all orders of this table since the table is NOT 'free'.
    // If the table is free, there are no active orders.
    if (table.status === 'free') {
      return res.json({ table, orders: [], total: 0 });
    }

    // When the table is occupied, we want to fetch all orders since the last time the table became occupied.
    // But since SQLite is simple, we can do this: fetch all orders of this table that are NOT paid.
    // How do we know they are not paid? We check if they are NOT linked to a transaction, or we can just fetch all orders
    // that were created after the last table reset.
    // To make it simple: We fetch all orders of this table where the table status is 'occupied' or 'waiting_payment',
    // and we delete or clear orders when a table is reset, OR we can select all orders that have status in ('received', 'preparing', 'ready', 'delivered')
    // and sum their totals. Once checkout transaction is registered, we set the orders status to a final 'archived' status OR we simply fetch
    // all orders where the order ID is greater than the last transaction ID for this table, or even simpler:
    // We add a `paid` column to `orders` (0 or 1).
    // Wait, adding a `paid` column to `orders` table is extremely clean and professional! Let's do that!
    // Oh, in my `db.js` migrations, I didn't include `paid` in `orders`. Let's check `orders` schema.
    // Yes, we can update the database to include a `paid` column, or we can assume any order with status != 'completed/archived' is active,
    // OR we can just add a `paid` column! Let's add a `paid` column defaulting to 0.
    // Wait, we can run an ALTER table, or since it's initial setup and the db is empty, we can just edit the schema in `db.js` to add `paid INTEGER DEFAULT 0` to orders!
    // Yes! Let's check what I created in `db.js`:
    // `orders` schema has: id, table_id, user_id, client_name, status, total_amount, created_at, updated_at.
    // Let's modify `db.js` later or we can just check if orders are paid.
    // Actually, to make it even simpler, we can mark orders as 'paid' by setting their status to 'completed' or 'finalized' or adding `paid` field.
    // Let's check: if we just set `paid` field to `INTEGER NOT NULL DEFAULT 0` in `orders`, it is perfect. Let's update `db.js` or write a migration.
    // Since the database was just created, we can just replace the definition or execute a quick SQLite migration.
    // Wait, let's look at `db.js`. It runs `CREATE TABLE IF NOT EXISTS orders`. Let's add `paid INTEGER NOT NULL DEFAULT 0` to the definition.
    // Wait, since we haven't run the backend yet, the database file doesn't exist, so we can just update `db.js` directly.
    // Let's check: yes, we can edit `db.js` to add `paid INTEGER NOT NULL DEFAULT 0`! That's awesome.
    // Let's do that in a bit, but first let's finish the controller using the `paid` field. We will fetch where `paid = 0` and `table_id = ?`.

    const orders = await db.all(
      `SELECT o.* FROM orders o 
       WHERE o.table_id = ? AND o.paid = 0`,
      [table.id]
    );

    let total = 0;
    for (const order of orders) {
      order.items = await db.all(
        `SELECT oi.*, p.name as name, p.category as category 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [order.id]
      );
      total += order.total_amount;
    }

    res.json({ table, orders, total });
  } catch (error) {
    console.error('Error fetching active table orders:', error);
    res.status(500).json({ message: 'Erro ao calcular consumo da mesa.' });
  }
}

export async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['received', 'preparing', 'ready', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Status de pedido inválido.' });
  }

  try {
    const db = await getDbConnection();
    const order = await db.get(
      `SELECT o.*, t.number as table_number 
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    await db.run(
      "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id]
    );

    const updatedOrder = { ...order, status, updated_at: new Date().toISOString() };

    // Broadcast status change
    const io = req.app.get('io');
    if (io) {
      io.emit('order_status_changed', updatedOrder);
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Erro ao atualizar status do pedido.' });
  }
}

// Cancel a single order item by order_item id (supports partial quantity)
export async function cancelOrderItem(req, res) {
  const { orderItemId } = req.params;
  // qty to cancel via query param or request body (if omitted or >= item qty, cancels all)
  const cancelQty = req.query.qty 
    ? parseInt(req.query.qty) 
    : (req.body && req.body.quantity) 
      ? parseInt(req.body.quantity) 
      : (req.body && req.body.qty) 
        ? parseInt(req.body.qty) 
        : null;

  const db = await getDbConnection();
  try {
    await db.run('BEGIN TRANSACTION');

    // Fetch the order item
    const item = await db.get(
      `SELECT oi.*, o.table_id, o.paid, o.total_amount, o.id as order_id, p.name as product_name
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE oi.id = ?`,
      [orderItemId]
    );

    if (!item) {
      await db.run('ROLLBACK');
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    if (item.paid) {
      await db.run('ROLLBACK');
      return res.status(400).json({ message: 'Não é possível cancelar item de um pedido já pago.' });
    }

    // Determine quantity to actually cancel
    const qtyToCancel = (cancelQty && cancelQty > 0 && cancelQty < item.quantity)
      ? parseInt(cancelQty)
      : item.quantity; // cancel all if not specified or >= total

    const isPartial = qtyToCancel < item.quantity;

    // Log cancellation to cancellations table
    const table = await db.get('SELECT number FROM tables WHERE id = ?', [item.table_id]);
    const tableNumber = table ? table.number : null;
    const reason = req.body.reason || req.query.reason || 'Desistência / Erro de lançamento';
    const employeeName = req.user ? req.user.name : 'Sistema';
    await db.run(
      `INSERT INTO cancellations (item_name, quantity, price, reason, table_number, employee_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.product_name, qtyToCancel, item.price, reason, tableNumber, employeeName]
    );

    // Restore stock if tracked
    const product = await db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
    if (product && product.track_stock === 1) {
      await db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [qtyToCancel, item.product_id]);
    }

    const amountToCancel = item.price * qtyToCancel;

    if (isPartial) {
      // Reduce quantity on the order_item
      const newQty = item.quantity - qtyToCancel;
      await db.run(
        `UPDATE order_items SET quantity = ? WHERE id = ?`,
        [newQty, orderItemId]
      );
    } else {
      // Delete the order item entirely
      await db.run('DELETE FROM order_items WHERE id = ?', [orderItemId]);
    }

    // Update order total
    const newOrderTotal = Math.max(0, item.total_amount - amountToCancel);
    await db.run(
      `UPDATE orders SET total_amount = ?, updated_at = NOW() WHERE id = ?`,
      [newOrderTotal, item.order_id]
    );

    // If no items remain in the order, delete it
    if (!isPartial) {
      const remaining = await db.get('SELECT COUNT(*) as cnt FROM order_items WHERE order_id = ?', [item.order_id]);
      if (remaining.cnt === 0) {
        await db.run('DELETE FROM orders WHERE id = ?', [item.order_id]);
      }
    }

    // Recalculate table total
    const tableOrders = await db.all(
      'SELECT total_amount FROM orders WHERE table_id = ? AND paid = 0',
      [item.table_id]
    );
    const tableTotal = tableOrders.reduce((sum, o) => sum + o.total_amount, 0);

    await db.run('COMMIT');

    // Notify clients via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('order_item_cancelled', {
        order_id: item.order_id,
        order_item_id: parseInt(orderItemId),
        table_id: item.table_id,
        qty_cancelled: qtyToCancel,
        new_table_total: tableTotal
      });
    }

    res.json({ message: `${qtyToCancel}x "${item.name}" cancelado(s) com sucesso.`, new_table_total: tableTotal });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error cancelling order item:', error);
    res.status(500).json({ message: 'Erro ao cancelar item.' });
  }
}

// Cancel all unpaid orders for a table
export async function cancelTableOrders(req, res) {
  const { tableId } = req.params;

  const db = await getDbConnection();
  try {
    await db.run('BEGIN TRANSACTION');

    const table = await db.get('SELECT * FROM tables WHERE id = ?', [tableId]);
    if (!table) {
      await db.run('ROLLBACK');
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    // Fetch all unpaid orders for this table
    const orders = await db.all(
      `SELECT o.id FROM orders o WHERE o.table_id = ? AND o.paid = 0`,
      [tableId]
    );

    for (const order of orders) {
      // Restore stock and log cancellations for all items in this order
      const items = await db.all(
        `SELECT oi.quantity, oi.product_id, oi.price, p.name, p.track_stock FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
        [order.id]
      );
      for (const item of items) {
        if (item.track_stock === 1) {
          await db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        // Log cancellation
        const reason = req.body.reason || req.query.reason || 'Cancelamento Geral de Mesa';
        const employeeName = req.user ? req.user.name : 'Sistema';
        await db.run(
          `INSERT INTO cancellations (item_name, quantity, price, reason, table_number, employee_name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [item.name, item.quantity, item.price, reason, table.number, employeeName]
        );
      }
      // Delete items and order
      await db.run('DELETE FROM order_items WHERE order_id = ?', [order.id]);
      await db.run('DELETE FROM orders WHERE id = ?', [order.id]);
    }

    // Reset the table to free with a new token (similar to resetTable)
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await db.run(
      `UPDATE tables SET status = 'free', token = ? WHERE id = ?`,
      [newToken, tableId]
    );

    await db.run('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('table_status_changed', { id: parseInt(tableId), number: table.number, status: 'free', token: newToken });
    }

    res.json({ message: 'Todos os pedidos da mesa foram cancelados e a mesa foi liberada.' });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error cancelling table orders:', error);
    res.status(500).json({ message: 'Erro ao cancelar pedidos da mesa.' });
  }
}
