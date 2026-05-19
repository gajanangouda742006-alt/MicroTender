const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { runComplaintChecks, updateReputation, validateImageWithAI } = require('../services/antifraud');
const { estimateCostAI, determinePriority } = require('../services/costEstimation');
const { analyzeComplaint, detectDuplicates } = require('../services/aiAnalyzer');
const notifications = require('./notifications');

const router = express.Router();

// POST /api/complaints/analyze
router.post('/analyze', authenticate, authorize('citizen'), upload.single('image'), async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;
    const imageUrl = req.file ? `uploads/${req.file.filename}` : null;
    const analysis = await analyzeComplaint(description || "", imageUrl ? `/${imageUrl}` : null);
    let duplicates = { isDuplicate: false, matches: [] };
    if (latitude && longitude) {
      duplicates = await detectDuplicates(parseFloat(latitude), parseFloat(longitude), analysis.category, description);
    }
    res.json({ analysis, duplicates });
  } catch (err) {
    console.error('Real-time analysis error:', err);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// POST /api/complaints
router.post('/', authenticate, authorize('citizen'), upload.single('image'), async (req, res) => {
  try {
    const { category, description, latitude, longitude, user_lat, user_lon } = req.body;
    if (!category || !description)
      return res.status(400).json({ error: 'Category and description are required.' });

    const lat = parseFloat(latitude) || null;
    const lon = parseFloat(longitude) || null;
    const imageUrl = req.file ? `uploads/${req.file.filename}` : null;

    const fraudCheck = await runComplaintChecks(
      req.user.user_id, description, lat, lon, imageUrl,
      parseFloat(user_lat) || null, parseFloat(user_lon) || null
    );
    if (!fraudCheck.passed) {
      return res.status(429).json({ error: 'Complaint blocked by anti-fraud system', reasons: fraudCheck.blocks });
    }

    const aiAnalysis = await analyzeComplaint(description, imageUrl ? `/${imageUrl}` : null);
    const duplicateCheck = await detectDuplicates(lat, lon, aiAnalysis.category, description);

    const result = await db.run(
      'INSERT INTO complaints (user_id, category, description, latitude, longitude, image_url, ai_analysis, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, aiAnalysis.category, description, lat, lon,
        imageUrl ? `/${imageUrl}` : null, JSON.stringify(aiAnalysis), aiAnalysis.department]
    );

    const complaint = await db.get('SELECT * FROM complaints WHERE complaint_id = ?', [result.insertId]);

    const priority = aiAnalysis.priority || determinePriority(aiAnalysis.category, description);
    const estimatedCost = aiAnalysis.estimatedCost || (await estimateCostAI(aiAnalysis.category, description)).estimatedCost;

    await db.run(
      'INSERT INTO micro_tenders (complaint_id, estimated_cost, priority) VALUES (?, ?, ?)',
      [complaint.complaint_id, estimatedCost, priority]
    );

    await db.run("UPDATE complaints SET status = 'tender_created' WHERE complaint_id = ?", [complaint.complaint_id]);
    await updateReputation(req.user.user_id, 'valid_complaint');

    const tender = await db.get('SELECT * FROM micro_tenders WHERE complaint_id = ?', [complaint.complaint_id]);

    await notifications.sendNotification(
      req.app, req.user.user_id, 'Complaint Received',
      `Your complaint for ${aiAnalysis.category} has been received and assigned to ${aiAnalysis.department}.`, 'success'
    );

    res.status(201).json({
      message: 'Complaint submitted and AI micro-tender generated',
      complaint: { ...complaint, status: 'tender_created' },
      tender, aiAnalysis, duplicates: duplicateCheck, fraudWarnings: fraudCheck.warnings
    });
  } catch (err) {
    console.error('Complaint error:', err);
    res.status(500).json({ error: 'Failed to submit complaint.' });
  }
});

// GET /api/complaints
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = '';
    const params = [];

    if (req.user.role === 'citizen') {
      query = 'SELECT c.*, u.name as citizen_name FROM complaints c JOIN users u ON c.user_id = u.user_id WHERE c.user_id = ?';
      params.push(req.user.user_id);
    } else {
      query = 'SELECT c.*, u.name as citizen_name FROM complaints c JOIN users u ON c.user_id = u.user_id WHERE 1=1';
    }

    if (status) { query += ' AND c.status = ?'; params.push(status); }
    if (category) { query += ' AND c.category = ?'; params.push(category); }
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const complaints = await db.all(query, params);

    let countQuery = req.user.role === 'citizen'
      ? 'SELECT COUNT(*) as total FROM complaints WHERE user_id = ?'
      : 'SELECT COUNT(*) as total FROM complaints WHERE 1=1';
    const countParams = req.user.role === 'citizen' ? [req.user.user_id] : [];
    if (status) { countQuery += ' AND status = ?'; countParams.push(status); }
    if (category) { countQuery += ' AND category = ?'; countParams.push(category); }

    const { total } = await db.get(countQuery, countParams);
    res.json({ complaints, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Get complaints error:', err);
    res.status(500).json({ error: 'Failed to get complaints.' });
  }
});

// GET /api/complaints/scoreboard/citizens
router.get('/scoreboard/citizens', authenticate, async (req, res) => {
  try {
    const scoreboard = await db.all(`
      SELECT u.user_id, u.name, u.reputation_score,
             COUNT(c.complaint_id) as total_complaints,
             SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as resolved_complaints
      FROM users u
      LEFT JOIN complaints c ON u.user_id = c.user_id
      WHERE u.role = 'citizen'
      GROUP BY u.user_id
      ORDER BY u.reputation_score DESC, resolved_complaints DESC
      LIMIT 50
    `, []);
    res.json({ scoreboard });
  } catch (err) {
    console.error('Scoreboard error:', err);
    res.status(500).json({ error: 'Failed to get scoreboard.' });
  }
});

// GET /api/complaints/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const complaint = await db.get(`
      SELECT c.*, u.name as citizen_name, u.phone as citizen_phone
      FROM complaints c JOIN users u ON c.user_id = u.user_id
      WHERE c.complaint_id = ?
    `, [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });

    const tender = await db.get(`
      SELECT mt.*, v.company_name as vendor_company, u.name as vendor_name
      FROM micro_tenders mt
      LEFT JOIN vendors v ON mt.assigned_vendor_id = v.vendor_id
      LEFT JOIN users u ON v.user_id = u.user_id
      WHERE mt.complaint_id = ?
    `, [complaint.complaint_id]);

    const applications = await db.all(`
      SELECT a.*, v.company_name, u.name as vendor_name, v.rating_avg
      FROM applications a
      JOIN vendors v ON a.vendor_id = v.vendor_id
      JOIN users u ON v.user_id = u.user_id
      WHERE a.tender_id = ?
      ORDER BY a.bid_amount ASC
    `, [tender?.tender_id || 0]);

    const rating = await db.get('SELECT * FROM ratings WHERE complaint_id = ?', [complaint.complaint_id]);
    
    const workUpdates = tender ? await db.all(
      `SELECT wu.*, v.company_name, u.name as vendor_name
       FROM work_updates wu
       JOIN vendors v ON wu.vendor_id = v.vendor_id
       JOIN users u ON v.user_id = u.user_id
       WHERE wu.tender_id = ?
       ORDER BY wu.created_at DESC`,
      [tender.tender_id]
    ) : [];

    res.json({ complaint, tender, applications, rating, workUpdates });
  } catch (err) {
    console.error('Get complaint error:', err);
    res.status(500).json({ error: 'Failed to get complaint.' });
  }
});

// POST /api/complaints/:id/rate
router.post('/:id/rate', authenticate, authorize('citizen'), async (req, res) => {
  try {
    const { score, feedback } = req.body;
    if (!score || score < 1 || score > 5)
      return res.status(400).json({ error: 'Score must be between 1 and 5.' });

    const complaint = await db.get(
      'SELECT * FROM complaints WHERE complaint_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    if (complaint.status !== 'completed')
      return res.status(400).json({ error: 'Can only rate completed complaints.' });

    const tender = await db.get('SELECT * FROM micro_tenders WHERE complaint_id = ?', [complaint.complaint_id]);
    if (!tender?.assigned_vendor_id) return res.status(400).json({ error: 'No vendor assigned.' });

    const existing = await db.get(
      'SELECT rating_id FROM ratings WHERE complaint_id = ? AND user_id = ?',
      [complaint.complaint_id, req.user.user_id]
    );
    if (existing) return res.status(409).json({ error: 'Already rated.' });

    await db.run(
      'INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback) VALUES (?, ?, ?, ?, ?)',
      [tender.assigned_vendor_id, complaint.complaint_id, req.user.user_id, score, feedback || null]
    );

    const avgResult = await db.get('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE vendor_id = ?', [tender.assigned_vendor_id]);
    await db.run('UPDATE vendors SET rating_avg = ?, total_ratings = ? WHERE vendor_id = ?',
      [Math.round(avgResult.avg * 10) / 10, avgResult.count, tender.assigned_vendor_id]);

    await updateReputation(req.user.user_id, score >= 3 ? 'good_rating' : 'bad_rating');
    res.json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error('Rating error:', err);
    res.status(500).json({ error: 'Failed to submit rating.' });
  }
});

module.exports = router;
