const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { runComplaintChecks, updateReputation, validateImageWithAI } = require('../services/antifraud');
const { estimateCostAI, determinePriority } = require('../services/costEstimation');
const { analyzeComplaint, detectDuplicates, analyzeReviewSentiment } = require('../services/aiAnalyzer');
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
const { submitComplaint } = require('../services/complaintService');

router.post('/', authenticate, authorize('citizen'), upload.single('image'), async (req, res) => {
  try {
    const data = {
      ...req.body,
      imageUrl: req.file ? `uploads/${req.file.filename}` : null
    };

    const result = await submitComplaint(req.app, req.user.user_id, data);

    res.status(201).json({
      message: 'Complaint submitted and is under admin review',
      complaint: result.complaint,
      aiAnalysis: result.aiAnalysis,
      duplicates: result.duplicates,
      fraudWarnings: result.fraudWarnings,
      tender: result.tender
    });
  } catch (err) {
    console.error('Complaint error:', err);
    if (err.status) {
      return res.status(err.status).json({ error: err.error, reasons: err.reasons });
    }
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

// GET /api/complaints/my
router.get('/my', authenticate, authorize('citizen'), async (req, res) => {
  try {
    console.log('=== GET /api/complaints/my ===');
    console.log('Authenticated User:', JSON.stringify(req.user));

    // First ensure the columns exist
    const columnsToAdd = [
      { col: 'verification_status', def: "VARCHAR(50) DEFAULT 'pending'" },
      { col: 'completion_image', def: 'VARCHAR(255)' },
      { col: 'completion_note', def: 'TEXT' },
    ];
    for (const c of columnsToAdd) {
      try {
        await db.run(`ALTER TABLE micro_tenders ADD COLUMN ${c.col} ${c.def}`);
      } catch (e) { /* column already exists */ }
    }

    const complaints = await db.all(`
      SELECT
        c.complaint_id,
        c.description,
        c.category,
        c.created_at,
        c.status,
        c.image_url,
        c.latitude,
        c.longitude,
        c.ai_analysis,
        c.department,
        mt.tender_id,
        mt.status as tender_status,
        mt.verification_status,
        mt.completion_image,
        mt.completion_note,
        u.name AS vendor_name,
        u.phone as vendor_phone,
        v.company_name,
        v.rating_avg,
        (SELECT COUNT(*) FROM ratings WHERE complaint_id = c.complaint_id) as has_rated
      FROM complaints c
      LEFT JOIN micro_tenders mt ON c.complaint_id = mt.complaint_id
      LEFT JOIN vendors v ON mt.assigned_vendor_id = v.vendor_id
      LEFT JOIN users u ON v.user_id = u.user_id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [req.user.user_id]);

    console.log('Complaints found:', complaints.length);
    res.json({ complaints: complaints || [] });
  } catch (err) {
    console.error('Get my complaints error:', err);
    res.status(500).json({ error: 'Failed to get complaints.', details: err.message });
  }
});

// GET /api/complaints/completed
router.get('/completed', authenticate, authorize('citizen'), async (req, res) => {
  try {
    const complaints = await db.all(`
      SELECT
        c.complaint_id,
        c.category,
        c.description,
        c.image_url,
        c.status,
        c.created_at,
        c.updated_at,
        c.latitude,
        c.longitude,
        c.ai_analysis,
        c.department,
        mt.tender_id,
        mt.priority,
        mt.estimated_cost,
        mt.verification_status,
        mt.completed_at,
        v.vendor_id,
        v.company_name,
        v.rating_avg,
        v.total_jobs_completed,
        u.name AS vendor_name,
        r.rating_id,
        r.score AS citizen_rating,
        r.feedback AS citizen_review,
        r.created_at AS citizen_reviewed_at,
        cp.cover_image_url,
        cp.image_urls,
        cp.completion_note,
        cp.reviewed_at AS completion_date
      FROM complaints c
      JOIN micro_tenders mt ON mt.complaint_id = c.complaint_id
      LEFT JOIN vendors v ON v.vendor_id = mt.assigned_vendor_id
      LEFT JOIN users u ON u.user_id = v.user_id
      LEFT JOIN ratings r
        ON r.complaint_id = c.complaint_id
       AND r.user_id = ?
      LEFT JOIN completion_proofs cp ON cp.proof_id = (
        SELECT proof_id
        FROM completion_proofs
        WHERE tender_id = mt.tender_id AND status = 'approved'
        ORDER BY reviewed_at DESC, submitted_at DESC
        LIMIT 1
      )
      WHERE c.user_id = ?
        AND c.status = 'completed'
        AND mt.verification_status = 'verified'
      ORDER BY COALESCE(cp.reviewed_at, mt.completed_at, c.updated_at) DESC
    `, [req.user.user_id, req.user.user_id]);

    res.json({
      complaints: complaints.map((complaint) => ({
        ...complaint,
        image_urls: complaint.image_urls ? JSON.parse(complaint.image_urls) : [],
      })),
    });
  } catch (err) {
    console.error('Get completed complaints error:', err);
    res.status(500).json({ error: 'Failed to get completed complaints.' });
  }
});

// DELETE /api/complaints/:id
router.delete('/:id', authenticate, authorize('citizen'), async (req, res) => {
  try {
    const complaint = await db.get(
      'SELECT * FROM complaints WHERE complaint_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });

    // Delete associated tender first (cascade should handle, but be safe)
    await db.run('DELETE FROM micro_tenders WHERE complaint_id = ?', [req.params.id]);
    await db.run('DELETE FROM complaints WHERE complaint_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);

    res.json({ message: 'Complaint deleted successfully' });
  } catch (err) {
    console.error('Delete complaint error:', err);
    res.status(500).json({ error: 'Failed to delete complaint.' });
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

    if (req.user.role === 'citizen' && complaint.user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Unauthorized access to this complaint.' });
    }

    if (req.user.role === 'vendor') {
      const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
      if (!vendor) {
        return res.status(403).json({ error: 'Vendor profile not found.' });
      }

      const accessCheck = await db.get(`
        SELECT a.application_id, mt.assigned_vendor_id
        FROM micro_tenders mt
        LEFT JOIN applications a
          ON a.tender_id = mt.tender_id
         AND a.vendor_id = ?
        WHERE mt.complaint_id = ?
          AND (a.application_id IS NOT NULL OR mt.assigned_vendor_id = ?)
        LIMIT 1
      `, [vendor.vendor_id, req.params.id, vendor.vendor_id]);

      if (!accessCheck) {
        return res.status(403).json({ error: 'Unauthorized access to this complaint.' });
      }
    }

    const tender = await db.get(`
      SELECT mt.*, v.company_name as vendor_company, u.name as vendor_name,
             v.rating_avg, v.total_jobs_completed, v.vendor_id
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
    const completionProofs = tender ? await db.all(`
      SELECT *
      FROM completion_proofs
      WHERE tender_id = ?
      ORDER BY submitted_at DESC
    `, [tender.tender_id]) : [];
    
    const workUpdates = tender ? await db.all(
      `SELECT wu.*, v.company_name, u.name as vendor_name
       FROM work_updates wu
       JOIN vendors v ON wu.vendor_id = v.vendor_id
       JOIN users u ON v.user_id = u.user_id
       WHERE wu.tender_id = ?
       ORDER BY wu.created_at DESC`,
      [tender.tender_id]
    ) : [];

    res.json({
      complaint,
      tender,
      applications,
      rating,
      workUpdates,
      completionProofs: completionProofs.map((proof) => ({
        ...proof,
        image_urls: proof.image_urls ? JSON.parse(proof.image_urls) : [],
      })),
    });
  } catch (err) {
    console.error('Get complaint error:', err);
    res.status(500).json({ error: 'Failed to get complaint.' });
  }
});

// POST /api/complaints/:id/rate
router.post('/:id/rate', authenticate, authorize('citizen'), upload.single('proof'), async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const proofImage = req.file ? `/uploads/${req.file.filename}` : null;
    if (!score || score < 1 || score > 5)
      return res.status(400).json({ error: 'Score must be between 1 and 5.' });

    const complaint = await db.get(
      'SELECT * FROM complaints WHERE complaint_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });

    const tender = await db.get('SELECT * FROM micro_tenders WHERE complaint_id = ?', [complaint.complaint_id]);
    if (!tender?.assigned_vendor_id) return res.status(400).json({ error: 'No vendor assigned.' });
    if (tender.status !== 'completed' && tender.status !== 'closed')
      return res.status(400).json({ error: 'Can only rate completed work.' });
    if (tender.verification_status !== 'verified')
      return res.status(400).json({ error: 'Work must be verified by admin first.' });

    const existing = await db.get(
      'SELECT rating_id FROM ratings WHERE complaint_id = ? AND user_id = ?',
      [complaint.complaint_id, req.user.user_id]
    );
    if (existing) return res.status(409).json({ error: 'Already rated.' });

    const sentiment = await analyzeReviewSentiment(feedback);
    
    await db.run(
      'INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback, proof_image, ai_sentiment, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tender.assigned_vendor_id, complaint.complaint_id, req.user.user_id, score, feedback || null, proofImage, sentiment, true]
    );

    // Dynamic vendor score calculation
    const avgResult = await db.get('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE vendor_id = ?', [tender.assigned_vendor_id]);
    const avgRating = Math.round((avgResult.avg || 0) * 10) / 10;
    const completedCount = await db.get('SELECT COUNT(*) as count FROM micro_tenders WHERE assigned_vendor_id = ? AND verification_status = "verified"', [tender.assigned_vendor_id]);
    const fraudCount = await db.get('SELECT COUNT(*) as count FROM fraud_logs WHERE user_id = (SELECT user_id FROM vendors WHERE vendor_id = ?)', [tender.assigned_vendor_id]);
    const rejectedCount = await db.get('SELECT COUNT(*) as count FROM micro_tenders WHERE assigned_vendor_id = ? AND verification_status = "rejected"', [tender.assigned_vendor_id]);
    
    const vendorScore = (avgRating * 20) + (completedCount.count * 2) - (fraudCount.count * 10) - (rejectedCount.count * 5);
    
    await db.run('UPDATE vendors SET rating_avg = ?, total_ratings = ?, total_jobs_completed = ?, vendor_score = ? WHERE vendor_id = ?',
      [avgRating, avgResult.count, completedCount.count, vendorScore, tender.assigned_vendor_id]);

    await updateReputation(req.user.user_id, score >= 3 ? 'good_rating' : 'bad_rating');
    
    // Notify vendor
    const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [tender.assigned_vendor_id]);
    if (vendorUser) {
       await notifications.sendNotification(req.app, vendorUser.user_id, 'Review Submitted', `A citizen has rated your work ${score}/5 stars.`, 'success');
    }

    res.json({ message: 'Rating submitted successfully', sentiment });
  } catch (err) {
    console.error('Rating error:', err);
    res.status(500).json({ error: 'Failed to submit rating.' });
  }
});

module.exports = router;
