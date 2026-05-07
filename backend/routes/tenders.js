const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { estimateCost } = require('../services/costEstimation');

const router = express.Router();

/**
 * GET /api/tenders
 * Get tenders (filtered by status, role context)
 */
router.get('/', authenticate, (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = `
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url,
             u.name as citizen_name, v.company_name as vendor_company
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      LEFT JOIN vendors v ON mt.assigned_vendor_id = v.vendor_id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND mt.status = ?'; params.push(status); }
    if (priority) { query += ' AND mt.priority = ?'; params.push(priority); }

    // Vendors only see open tenders or their assigned ones
    if (req.user.role === 'vendor') {
      const vendor = db.prepare('SELECT vendor_id FROM vendors WHERE user_id = ?').get(req.user.user_id);
      if (vendor) {
        query += ' AND (mt.status = ? OR mt.assigned_vendor_id = ?)';
        params.push('open', vendor.vendor_id);
      }
    }

    query += ' ORDER BY mt.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const tenders = db.prepare(query).all(...params);
    res.json({ tenders });
  } catch (err) {
    console.error('Get tenders error:', err);
    res.status(500).json({ error: 'Failed to get tenders.' });
  }
});

/**
 * GET /api/tenders/:id
 * Get tender details
 */
router.get('/:id', authenticate, (req, res) => {
  try {
    const tender = db.prepare(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url, c.status as complaint_status,
             u.name as citizen_name, u.phone as citizen_phone
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.tender_id = ?
    `).get(req.params.id);

    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    // Get applications
    const applications = db.prepare(`
      SELECT a.*, v.company_name, v.rating_avg, v.total_jobs_completed, u.name as vendor_name
      FROM applications a
      JOIN vendors v ON a.vendor_id = v.vendor_id
      JOIN users u ON v.user_id = u.user_id
      WHERE a.tender_id = ?
      ORDER BY a.bid_amount ASC
    `).all(tender.tender_id);

    // Get cost estimate breakdown
    const costBreakdown = estimateCost(tender.category, { urgency: tender.priority });

    res.json({ tender, applications, costBreakdown });
  } catch (err) {
    console.error('Get tender error:', err);
    res.status(500).json({ error: 'Failed to get tender.' });
  }
});

/**
 * PATCH /api/tenders/:id/status
 * Update tender status (admin or assigned vendor)
 */
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const tender = db.prepare('SELECT * FROM micro_tenders WHERE tender_id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    // Permission check
    if (req.user.role === 'vendor') {
      const vendor = db.prepare('SELECT vendor_id FROM vendors WHERE user_id = ?').get(req.user.user_id);
      if (!vendor || tender.assigned_vendor_id !== vendor.vendor_id) {
        return res.status(403).json({ error: 'Not authorized.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    db.prepare('UPDATE micro_tenders SET status = ? WHERE tender_id = ?').run(status, tender.tender_id);

    // Sync complaint status
    const complaintStatusMap = {
      'assigned': 'assigned',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'cancelled': 'rejected'
    };
    if (complaintStatusMap[status]) {
      db.prepare('UPDATE complaints SET status = ?, updated_at = datetime("now") WHERE complaint_id = ?')
        .run(complaintStatusMap[status], tender.complaint_id);
    }

    // Update vendor stats on completion
    if (status === 'completed' && tender.assigned_vendor_id) {
      db.prepare('UPDATE vendors SET total_jobs_completed = total_jobs_completed + 1 WHERE vendor_id = ?')
        .run(tender.assigned_vendor_id);
    }

    res.json({ message: 'Tender status updated', status });
  } catch (err) {
    console.error('Update tender error:', err);
    res.status(500).json({ error: 'Failed to update tender.' });
  }
});

module.exports = router;
