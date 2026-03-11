const express = require('express');
const router = express.Router();
const db = require('../models/database');

// 获取职位列表
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      location, 
      keyword, 
      page = 1, 
      limit = 20,
      days = 30
    } = req.query;

    let sql = `
      SELECT * FROM jobs 
      WHERE status = 'active' 
      AND date(publish_date) >= date('now', '-${days} days')
    `;
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (location) {
      sql += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }

    if (keyword) {
      sql += ' AND (title LIKE ? OR company LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY publish_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const jobs = await db.query(sql, params);
    
    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total FROM jobs 
      WHERE status = 'active' 
      AND date(publish_date) >= date('now', '-${days} days')
    `;
    const countParams = [];
    
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }
    if (location) {
      countSql += ' AND location LIKE ?';
      countParams.push(`%${location}%`);
    }
    if (keyword) {
      countSql += ' AND (title LIKE ? OR company LIKE ? OR description LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    const countResult = await db.query(countSql, countParams);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取职位详情
router.get('/:id', async (req, res) => {
  try {
    const jobs = await db.query('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (jobs.length === 0) {
      return res.status(404).json({ success: false, error: '职位不存在' });
    }
    
    // 增加浏览次数
    await db.run('UPDATE jobs SET views = views + 1 WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, data: jobs[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取分类统计
router.get('/stats/categories', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM jobs 
      WHERE status = 'active' 
      AND date(publish_date) >= date('now', '-30 days')
      GROUP BY category
    `);
    
    const categoryNames = {
      'ai_engineer': 'AI工程师',
      'data_engineer': '大数据工程师',
      'data_analyst': '数据分析师',
      'python_dev': 'Python开发',
      'other': '其他'
    };
    
    res.json({
      success: true,
      data: stats.map(s => ({
        ...s,
        name: categoryNames[s.category] || s.category
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加职位（管理后台）
router.post('/', async (req, res) => {
  try {
    const {
      title, company, location, salary, description,
      requirements, job_type, category, source, source_url
    } = req.body;

    if (!title || !company || !location || !category) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const result = await db.run(
      `INSERT INTO jobs (title, company, location, salary, description, requirements,
       job_type, category, source, source_url, publish_date, is_verified, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, company, location, salary || '面议',
        description || '', requirements || '',
        job_type || '全职', category, source || '手动录入',
        source_url || '', new Date().toISOString().split('T')[0],
        1, // 手动录入默认已验证
        'active'
      ]
    );

    res.json({ success: true, data: { id: result.id }, message: '职位添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新职位（管理后台）
router.put('/:id', async (req, res) => {
  try {
    const {
      title, company, location, salary, description,
      requirements, job_type, category, source, source_url
    } = req.body;

    const result = await db.run(
      `UPDATE jobs SET
        title = ?, company = ?, location = ?, salary = ?,
        description = ?, requirements = ?, job_type = ?,
        category = ?, source = ?, source_url = ?
       WHERE id = ?`,
      [
        title, company, location, salary,
        description, requirements, job_type,
        category, source, source_url, req.params.id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '职位不存在' });
    }

    res.json({ success: true, message: '职位更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除职位（管理后台）
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run(
      'UPDATE jobs SET status = ? WHERE id = ?',
      ['deleted', req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '职位不存在' });
    }

    res.json({ success: true, message: '职位已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 审核职位（管理后台）
router.post('/:id/verify', async (req, res) => {
  try {
    const result = await db.run(
      'UPDATE jobs SET is_verified = ? WHERE id = ?',
      [1, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '职位不存在' });
    }

    res.json({ success: true, message: '职位审核通过' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有职位（管理后台，不分页）
router.get('/admin/all', async (req, res) => {
  try {
    const jobs = await db.query(
      'SELECT * FROM jobs WHERE status = ? ORDER BY crawl_date DESC',
      ['active']
    );
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
