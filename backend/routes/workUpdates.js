const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyWorkCompletion } = require('../services/antifraud');

const router = express.Router();

// POST /api/work-updates - Vendor submits a progress update
router.post('/', authenticate, authorize('vendor'), upload.single('image'), async (req, res) => {
  try {
    const { tender_id, description, latitude, longitude, progress_percentage } = req.body;
    if (!tender_id || !description) {
      return res.status(400).json({ error: 'tender_id and description are required.' });
    }

    // Verify vendor owns this tender
    const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) return res.status(403).json({ error: 'Vendor profile not found.' });

    const tender = await db.get(
      'SELECT * FROM micro_tenders WHERE tender_id = ? AND assigned_vendor_id = ?',
      [tender_id, vendor.vendor_id]
    );
    if (!tender) return res.status(403).json({ error: 'You are not assigned to this tender.' });
    if (!['assigned', 'in_progress'].includes(tender.status)) {
      return res.status(400).json({ error: 'Tender is not in a workable state.' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const progress = Math.min(100, Math.max(0, parseInt(progress_percentage) || 0));

    // Fetch original complaint for the Before image
    const complaint = await db.get(
      'SELECT * FROM complaints WHERE complaint_id = ?',
      [tender.complaint_id]
    );

    let verificationStatus = 'verified';
    let verificationReasoning = 'No after photo uploaded yet to verify.';

    if (imageUrl && complaint && complaint.image_url) {
      const verification = await verifyWorkCompletion(
        complaint.image_url,
        imageUrl,
        complaint.category,
        complaint.description
      );
      verificationStatus = verification.status;
      verificationReasoning = verification.reasoning;
    }

    const result = await db.run(
      'INSERT INTO work_updates (tender_id, vendor_id, description, image_url, latitude, longitude, progress_percentage, verification_status, verification_reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tender_id, vendor.vendor_id, description, imageUrl, latitude || null, longitude || null, progress, verificationStatus, verificationReasoning]
    );

    // Auto-update tender status to completed if 100% progress, else in_progress
    if (progress === 100) {
      await db.run("UPDATE micro_tenders SET status = 'completed' WHERE tender_id = ?", [tender_id]);
      await db.run("UPDATE complaints SET status = 'completed', updated_at = NOW() WHERE complaint_id = ?", [tender.complaint_id]);
      await db.run("UPDATE vendors SET total_jobs_completed = total_jobs_completed + 1 WHERE vendor_id = ?", [vendor.vendor_id]);
    } else if (tender.status === 'assigned') {
      await db.run("UPDATE micro_tenders SET status = 'in_progress' WHERE tender_id = ?", [tender_id]);
      await db.run("UPDATE complaints SET status = 'in_progress' WHERE complaint_id = ?", [tender.complaint_id]);
    }

    // Create notification for the citizen using pre-fetched complaint details
    if (complaint) {
      await db.run(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [complaint.user_id, 'Work Progress Update', `Vendor submitted ${progress}% progress on your complaint: "${complaint.description?.substring(0, 50)}..."`, 'work_update']
      );
    }

    const update = await db.get('SELECT * FROM work_updates WHERE update_id = ?', [result.insertId]);
    res.status(201).json({ message: 'Progress update submitted.', update });
  } catch (err) {
    console.error('Work update error:', err);
    res.status(500).json({ error: 'Failed to submit progress update.' });
  }
});

// GET /api/work-updates/:tender_id - Get all progress updates for a tender
router.get('/:tender_id', authenticate, async (req, res) => {
  try {
    const { tender_id } = req.params;
    const updates = await db.all(
      `SELECT wu.*, v.company_name, u.name as vendor_name
       FROM work_updates wu
       JOIN vendors v ON wu.vendor_id = v.vendor_id
       JOIN users u ON v.user_id = u.user_id
       WHERE wu.tender_id = ?
       ORDER BY wu.created_at DESC`,
      [tender_id]
    );
    res.json({ updates });
  } catch (err) {
    console.error('Get work updates error:', err);
    res.status(500).json({ error: 'Failed to fetch progress updates.' });
  }
});

module.exports = router;
