const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { findNearbyVendors, getActiveJobsCount, haversineDistance } = require('../services/vendorMatching');
const notifications = require('./notifications');

const router = express.Router();

// POST /api/vendors/register
router.post('/register', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { company_name, category, skills, latitude, longitude, address, experience_years } = req.body;
    const existing = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (existing) return res.status(409).json({ error: 'Vendor profile already exists.' });

    const result = await db.run(
      'INSERT INTO vendors (user_id, company_name, category, skills, latitude, longitude, address, experience_years) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, company_name || null, category || null, JSON.stringify(skills || []),
        parseFloat(latitude) || null, parseFloat(longitude) || null, address || null, parseInt(experience_years) || 0]
    );
    const vendor = await db.get('SELECT * FROM vendors WHERE vendor_id = ?', [result.insertId]);
    res.status(201).json({ message: 'Vendor profile created', vendor });
  } catch (err) {
    console.error('Vendor register error:', err);
    res.status(500).json({ error: 'Failed to register vendor.' });
  }
});

// GET /api/vendors/profile
router.get('/profile', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await db.get(`
      SELECT v.*, u.name, u.email, u.phone, u.govt_id_type, u.govt_id_number, u.reputation_score
      FROM vendors v JOIN users u ON v.user_id = u.user_id
      WHERE v.user_id = ?
    `, [req.user.user_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
    const activeJobs = await getActiveJobsCount(vendor.vendor_id);
    res.json({ vendor, activeJobs });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

// PUT /api/vendors/profile
router.put('/profile', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { company_name, category, skills, latitude, longitude, address, experience_years, is_available, name, phone } = req.body;
    const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    await db.run(`
      UPDATE vendors SET
        company_name = COALESCE(?, company_name),
        category = COALESCE(?, category),
        skills = COALESCE(?, skills),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        address = COALESCE(?, address),
        experience_years = COALESCE(?, experience_years),
        is_available = COALESCE(?, is_available)
      WHERE vendor_id = ?
    `, [company_name || null, category || null, skills ? JSON.stringify(skills) : null,
        latitude != null ? parseFloat(latitude) : null,
        longitude != null ? parseFloat(longitude) : null,
        address || null,
        experience_years != null ? parseInt(experience_years) : null,
        is_available != null ? (is_available ? 1 : 0) : null,
        vendor.vendor_id]);

    if (name || phone) {
      await db.run('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE user_id = ?',
        [name || null, phone || null, req.user.user_id]);
    }

    const updated = await db.get('SELECT * FROM vendors WHERE vendor_id = ?', [vendor.vendor_id]);
    res.json({ message: 'Profile updated', vendor: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// GET /api/vendors/nearby-tenders
router.get('/nearby-tenders', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await db.get('SELECT * FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
    if (!vendor.latitude || !vendor.longitude)
      return res.status(400).json({ error: 'Update your location to see nearby tenders.' });

    const radius = parseFloat(req.query.radius) || 5;
    const tenders = await db.all(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url, u.name as citizen_name
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.status = 'open' AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      ORDER BY mt.created_at DESC
    `, []);

    const nearbyTenders = tenders
      .map(t => ({ ...t, distance: Math.round(haversineDistance(vendor.latitude, vendor.longitude, t.latitude, t.longitude) * 100) / 100 }))
      .filter(t => t.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    const appliedRows = await db.all('SELECT tender_id FROM applications WHERE vendor_id = ?', [vendor.vendor_id]);
    const appliedTenderIds = appliedRows.map(a => a.tender_id);

    const result = nearbyTenders.map(t => ({ ...t, hasApplied: appliedTenderIds.includes(t.tender_id) }));
    res.json({ tenders: result, vendorLocation: { lat: vendor.latitude, lon: vendor.longitude } });
  } catch (err) {
    console.error('Nearby tenders error:', err);
    res.status(500).json({ error: 'Failed to get nearby tenders.' });
  }
});

// POST /api/vendors/apply/:tenderId
router.post('/apply/:tenderId', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { bid_amount, proposal } = req.body;
    if (!bid_amount || bid_amount <= 0)
      return res.status(400).json({ error: 'Valid bid amount is required.' });

    const vendor = await db.get('SELECT * FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [req.params.tenderId]);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });
    if (tender.status !== 'open') return res.status(400).json({ error: 'Tender is no longer open.' });

    const existing = await db.get(
      'SELECT application_id FROM applications WHERE tender_id = ? AND vendor_id = ?',
      [tender.tender_id, vendor.vendor_id]
    );
    if (existing) return res.status(409).json({ error: 'Already applied to this tender.' });

    const result = await db.run(
      'INSERT INTO applications (tender_id, vendor_id, bid_amount, proposal) VALUES (?, ?, ?, ?)',
      [tender.tender_id, vendor.vendor_id, parseFloat(bid_amount), proposal || null]
    );
    const application = await db.get('SELECT * FROM applications WHERE application_id = ?', [result.insertId]);

    const citizen = await db.get(`
      SELECT c.user_id, c.category FROM complaints c
      JOIN micro_tenders mt ON c.complaint_id = mt.complaint_id
      WHERE mt.tender_id = ?
    `, [tender.tender_id]);

    if (citizen) {
      await notifications.sendNotification(req.app, citizen.user_id, 'New Bid Received',
        `A vendor has submitted a bid for your complaint: ${citizen.category}. Check the dashboard for details!`, 'info');
    }

    res.status(201).json({ message: 'Application submitted', application });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Failed to apply.' });
  }
});

// GET /api/vendors/my-jobs
router.get('/my-jobs', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const jobs = await db.all(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url,
             u.name as citizen_name, u.phone as citizen_phone
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.assigned_vendor_id = ?
      ORDER BY mt.created_at DESC
    `, [vendor.vendor_id]);

    const applications = await db.all(`
      SELECT a.*, mt.status as tender_status, c.category, c.description
      FROM applications a
      JOIN micro_tenders mt ON a.tender_id = mt.tender_id
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE a.vendor_id = ?
      ORDER BY a.created_at DESC
    `, [vendor.vendor_id]);

    res.json({ jobs, applications });
  } catch (err) {
    console.error('My jobs error:', err);
    res.status(500).json({ error: 'Failed to get jobs.' });
  }
});

// GET /api/vendors/all
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const vendors = await db.all(`
      SELECT v.*, u.name, u.email, u.phone, u.reputation_score, u.is_active
      FROM vendors v JOIN users u ON v.user_id = u.user_id
      ORDER BY v.rating_avg DESC
    `, []);
    res.json({ vendors });
  } catch (err) {
    console.error('List vendors error:', err);
    res.status(500).json({ error: 'Failed to list vendors.' });
  }
});

module.exports = router;
