import { getDbConnection } from '../config/db.js';

// GET /api/categories - List all active categories (public)
export async function getCategories(req, res) {
  try {
    const db = await getDbConnection();
    const categories = await db.all(
      `SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, name ASC`
    );
    return res.json(categories);
  } catch (err) {
    console.error('getCategories error:', err);
    return res.status(500).json({ message: 'Erro ao buscar categorias.' });
  }
}

// GET /api/categories/all - List all categories including inactive (admin)
export async function getAllCategories(req, res) {
  try {
    const db = await getDbConnection();
    const categories = await db.all(
      `SELECT * FROM categories ORDER BY sort_order ASC, name ASC`
    );
    return res.json(categories);
  } catch (err) {
    console.error('getAllCategories error:', err);
    return res.status(500).json({ message: 'Erro ao buscar categorias.' });
  }
}

// POST /api/categories - Create a new category
export async function createCategory(req, res) {
  try {
    const db = await getDbConnection();
    const { name, icon, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'O nome da categoria é obrigatório.' });
    }

    const trimmedName = name.trim().toLowerCase();

    // Check if category already exists
    const existing = await db.get(
      `SELECT id FROM categories WHERE name = ?`,
      [trimmedName]
    );
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma categoria com este nome.' });
    }

    const result = await db.run(
      `INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?) RETURNING id`,
      [trimmedName, icon || 'package', sort_order || 0]
    );

    const category = await db.get(`SELECT * FROM categories WHERE id = ?`, [result.lastID]);
    return res.status(201).json({ message: 'Categoria criada com sucesso!', category });
  } catch (err) {
    console.error('createCategory error:', err);
    return res.status(500).json({ message: 'Erro ao criar categoria.' });
  }
}

// PUT /api/categories/:id - Update a category
export async function updateCategory(req, res) {
  try {
    const db = await getDbConnection();
    const { id } = req.params;
    const { name, icon, sort_order, active } = req.body;

    const category = await db.get(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    if (name) {
      const trimmedName = name.trim().toLowerCase();
      const existing = await db.get(
        `SELECT id FROM categories WHERE name = ? AND id != ?`,
        [trimmedName, id]
      );
      if (existing) {
        return res.status(400).json({ message: 'Já existe uma categoria com este nome.' });
      }

      // Update products that use the old category name
      await db.run(
        `UPDATE products SET category = ? WHERE category = ?`,
        [trimmedName, category.name]
      );
    }

    await db.run(
      `UPDATE categories SET name = ?, icon = ?, sort_order = ?, active = ? WHERE id = ?`,
      [
        name ? name.trim().toLowerCase() : category.name,
        icon !== undefined ? icon : category.icon,
        sort_order !== undefined ? sort_order : category.sort_order,
        active !== undefined ? (active ? 1 : 0) : category.active,
        id
      ]
    );

    const updated = await db.get(`SELECT * FROM categories WHERE id = ?`, [id]);
    return res.json({ message: 'Categoria atualizada com sucesso!', category: updated });
  } catch (err) {
    console.error('updateCategory error:', err);
    return res.status(500).json({ message: 'Erro ao atualizar categoria.' });
  }
}

// DELETE /api/categories/:id - Delete a category
export async function deleteCategory(req, res) {
  try {
    const db = await getDbConnection();
    const { id } = req.params;

    const category = await db.get(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada.' });
    }

    // Check if any products use this category
    const productsUsingCategory = await db.get(
      `SELECT COUNT(*) as count FROM products WHERE category = ?`,
      [category.name]
    );

    if (productsUsingCategory.count > 0) {
      return res.status(400).json({
        message: `Não é possível excluir. Existem ${productsUsingCategory.count} produto(s) nesta categoria. Remova ou reatribua os produtos primeiro.`
      });
    }

    await db.run(`DELETE FROM categories WHERE id = ?`, [id]);
    return res.json({ message: 'Categoria excluída com sucesso!' });
  } catch (err) {
    console.error('deleteCategory error:', err);
    return res.status(500).json({ message: 'Erro ao excluir categoria.' });
  }
}
