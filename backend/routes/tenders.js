const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { estimateCost } = require('../services/costEstimation');
const upload = require('../middleware/upload');
const { sendSmartNotification } = require('../services/notificationService');
const { assignTenderToVendor, submitCompletionProof } = require('../services/complaintLifecycleService');

const router = express.Router();

// GET /api/tenders
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = `
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url,
             u.name as citizen_name, v.company_name as vendor_company,
             (SELECT verification_status FROM work_updates WHERE tender_id = mt.tender_id ORDER BY created_at DESC LIMIT 1) as verification_status,
             (SELECT verification_reasoning FROM work_updates WHERE tender_id = mt.tender_id ORDER BY created_at DESC LIMIT 1) as verification_reasoning
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      LEFT JOIN vendors v ON mt.assigned_vendor_id = v.vendor_id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND mt.status = ?'; params.push(status); }
    if (priority) { query += ' AND mt.priority = ?'; params.push(priority); }

    if (req.user.role === 'vendor') {
      const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
      if (vendor) {
        query += ' AND (mt.status = ? OR mt.assigned_vendor_id = ?)';
        params.push('open', vendor.vendor_id);
      }
    }

    query += ' ORDER BY mt.created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const tenders = await db.all(query, params);
    res.json({ tenders });
  } catch (err) {
    console.error('Get tenders error:', err);
    res.status(500).json({ error: 'Failed to get tenders.' });
  }
});

// GET /api/tenders/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const tender = await db.get(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url, c.status as complaint_status,
             u.name as citizen_name, u.phone as citizen_phone
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.tender_id = ?
    `, [req.params.id]);

    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    const applications = await db.all(`
      SELECT a.*, v.company_name, v.rating_avg, v.total_jobs_completed, u.name as vendor_name
      FROM applications a
      JOIN vendors v ON a.vendor_id = v.vendor_id
      JOIN users u ON v.user_id = u.user_id
      WHERE a.tender_id = ?
      ORDER BY a.bid_amount ASC
    `, [tender.tender_id]);

    const costBreakdown = estimateCost(tender.category, { urgency: tender.priority });
    res.json({ tender, applications, costBreakdown });
  } catch (err) {
    console.error('Get tender error:', err);
    res.status(500).json({ error: 'Failed to get tender.' });
  }
});

// POST /api/tenders/assign
router.post('/assign', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { tender_id, vendor_id, notes, mode } = req.body;
    if (!tender_id || !vendor_id) {
      return res.status(400).json({ error: 'tender_id and vendor_id are required.' });
    }

    const result = await assignTenderToVendor({
      app: req.app,
      tenderId: tender_id,
      vendorId: vendor_id,
      adminId: req.user.user_id,
      notes: notes || '',
      mode: mode || 'manual',
    });

    res.status(201).json({ message: 'Tender assigned successfully.', assignment: result });
  } catch (err) {
    console.error('Tender assign error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to assign tender.' });
  }
});

// PATCH /api/tenders/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status.' });

    const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [req.params.id]);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    if (req.user.role === 'vendor') {
      const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
      if (!vendor || tender.assigned_vendor_id !== vendor.vendor_id)
        return res.status(403).json({ error: 'Not authorized.' });
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    await db.run('UPDATE micro_tenders SET status = ? WHERE tender_id = ?', [status, tender.tender_id]);

    const complaintStatusMap = {
      'assigned': 'assigned', 'in_progress': 'in_progress',
      'completed': 'completed', 'cancelled': 'rejected'
    };
    if (complaintStatusMap[status]) {
      await db.run('UPDATE complaints SET status = ?, updated_at = NOW() WHERE complaint_id = ?',
        [complaintStatusMap[status], tender.complaint_id]);
    }

    if (status === 'completed' && tender.assigned_vendor_id) {
      await db.run('UPDATE vendors SET total_jobs_completed = total_jobs_completed + 1 WHERE vendor_id = ?',
        [tender.assigned_vendor_id]);
    }

    res.json({ message: 'Tender status updated', status });
  } catch (err) {
    console.error('Update tender error:', err);
    res.status(500).json({ error: 'Failed to update tender.' });
  }
});

// POST /api/tenders/check-deadlines - Check approaching deadlines and notify assigned vendors
router.post('/check-deadlines', authenticate, async (req, res) => {
  try {
    const approachingTenders = await db.all(`
      SELECT mt.*, v.user_id as vendor_user_id, c.category
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN vendors v ON mt.assigned_vendor_id = v.vendor_id
      WHERE mt.status IN ('assigned', 'in_progress')
        AND mt.deadline IS NOT NULL
        AND mt.deadline <= DATE_ADD(NOW(), INTERVAL 1 DAY)
    `);

    const notificationsSent = [];
    const { sendSmartNotification } = require('../services/notificationService');

    for (const tender of approachingTenders) {
      const daysLeft = Math.max(0, Math.ceil((new Date(tender.deadline) - new Date()) / (1000 * 60 * 60 * 24)));
      const title = 'Work Deadline Reminder';
      const message = `Reminder: The deadline for resolving the "${tender.category}" issue is approaching. You have ${daysLeft} days remaining.`;
      
      await sendSmartNotification(req.app, tender.vendor_user_id, { title, message, type: 'warning' });
      notificationsSent.push({ tender_id: tender.tender_id, vendor_user_id: tender.vendor_user_id });
    }

    res.json({ message: 'Deadline checks completed successfully', notificationsSent });
  } catch (err) {
    console.error('Deadline checks error:', err);
    res.status(500).json({ error: 'Failed to run deadline check.' });
  }
});

// PUT /api/tenders/:id/complete - Vendor marks tender as completed with proof
router.put('/:id/complete', authenticate, authorize('vendor'), upload.fields([
  { name: 'completion_images', maxCount: 6 },
  { name: 'completion_image', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = [
      ...((req.files && req.files.completion_images) || []),
      ...((req.files && req.files.completion_image) || []),
    ];

    const result = await submitCompletionProof({
      app: req.app,
      tenderId: req.params.id,
      vendorUserId: req.user.user_id,
      files,
      completionNote: req.body.completion_note || '',
    });

    res.json({ success: true, message: 'Completion proof uploaded', ...result });
  } catch (err) {
    console.error('Completion error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to upload completion proof.' });
  }
});

module.exports = router;
