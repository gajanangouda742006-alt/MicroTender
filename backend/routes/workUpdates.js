const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyWorkCompletion } = require('../services/antifraud');
const { emitLifecycleEvent, submitCompletionProof } = require('../services/complaintLifecycleService');
const notifications = require('./notifications');

const router = express.Router();

// POST /api/work-updates - Vendor submits a progress update
router.post('/', authenticate, authorize('vendor'), upload.single('image'), async (req, res) => {
  try {
    const { tender_id, description, notes, latitude, longitude, progress_percentage } = req.body;
    const updateNotes = description || notes;
    if (!tender_id || !updateNotes) {
      return res.status(400).json({ error: 'tender_id and description are required.' });
    }

    // Verify vendor owns this tender
    const vendor = await db.get('SELECT vendor_id, user_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
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
      'INSERT INTO work_updates (tender_id, vendor_id, description, image_url, latitude, longitude, progress_percentage, verification_status, verification_reasoning, update_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [tender_id, vendor.vendor_id, updateNotes, imageUrl, latitude || null, longitude || null, progress, verificationStatus, verificationReasoning, 'progress']
    );

    // Notify Vendor if verification failed
    if (verificationStatus === 'failed' || verificationStatus === 'rejected') {
      await notifications.sendNotification(req.app, vendor.user_id, 'Verification Failed', 'Completion proof rejected. Please re-upload evidence.', 'error');
    }

    // Keep progress tracking separate from the final completion-proof step.
    if (tender.status === 'assigned') {
      await db.run("UPDATE micro_tenders SET status = 'in_progress' WHERE tender_id = ?", [tender_id]);
      await db.run("UPDATE complaints SET status = 'in_progress' WHERE complaint_id = ?", [tender.complaint_id]);
      
      // Citizen #6
      if (complaint) {
        await notifications.sendNotification(req.app, complaint.user_id, 'Work Started', 'Work on your complaint has started.', 'info');
      }
    } else {
      // General progress update
      if (complaint) {
        await notifications.sendNotification(req.app, complaint.user_id, 'Work Progress Update', `Vendor submitted ${progress}% progress on your complaint.`, 'info');
      }
      if (progress === 100) {
        const admins = await db.all("SELECT user_id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
          await notifications.sendNotification(req.app, admin.user_id, 'Vendor progress reached 100%', 'Final progress was submitted. Awaiting completion proof upload.', 'info');
        }
      }
    }

    const update = await db.get('SELECT * FROM work_updates WHERE update_id = ?', [result.insertId]);
    emitLifecycleEvent(req.app, 'work_update_created', tender.complaint_id, {
      tenderId: Number(tender_id),
      updateId: result.insertId,
      progress,
    });
    res.status(201).json({ message: 'Progress update submitted.', update });
  } catch (err) {
    console.error('Work update error:', err);
    res.status(500).json({ error: 'Failed to submit progress update.' });
  }
});

// POST /api/work-updates/complete - Vendor submits final completion proof
router.post('/complete', authenticate, authorize('vendor'), upload.fields([
  { name: 'completion_images', maxCount: 6 },
  { name: 'completion_image', maxCount: 1 },
]), async (req, res) => {
  try {
    const { tender_id, completion_note } = req.body;
    if (!tender_id) {
      return res.status(400).json({ error: 'tender_id is required.' });
    }

    const files = [
      ...((req.files && req.files.completion_images) || []),
      ...((req.files && req.files.completion_image) || []),
    ];

    const result = await submitCompletionProof({
      app: req.app,
      tenderId: tender_id,
      vendorUserId: req.user.user_id,
      files,
      completionNote: completion_note || '',
    });

    res.status(201).json({ message: 'Completion proof submitted successfully.', ...result });
  } catch (err) {
    console.error('Completion proof error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to submit completion proof.' });
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
