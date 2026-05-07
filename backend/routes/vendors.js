const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { findNearbyVendors, getActiveJobsCount } = require('../services/vendorMatching');
const notifications = require('./notifications');

const router = express.Router();

/**
 * POST /api/vendors/register
 * Register vendor profile (for users with vendor role)
 */
router.post('/register', authenticate, authorize('vendor'), (req, res) => {
  try {
    const { company_name, category, skills, latitude, longitude, address, experience_years } = req.body;

    // Check if already registered
    const existing = db.prepare('SELECT vendor_id FROM vendors WHERE user_id = ?').get(req.user.user_id);
    if (existing) {
      return res.status(409).json({ error: 'Vendor profile already exists.' });
    }

    const result = db.prepare(`
      INSERT INTO vendors (user_id, company_name, category, skills, latitude, longitude, address, experience_years)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.user_id,
      company_name || null,
      category || null,
      JSON.stringify(skills || []),
      parseFloat(latitude) || null,
      parseFloat(longitude) || null,
      address || null,
      parseInt(experience_years) || 0
    );

    const vendor = db.prepare('SELECT * FROM vendors WHERE vendor_id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Vendor profile created', vendor });
  } catch (err) {
    console.error('Vendor register error:', err);
    res.status(500).json({ error: 'Failed to register vendor.' });
  }
});

/**
 * GET /api/vendors/profile
 * Get current vendor's profile
 */
router.get('/profile', authenticate, authorize('vendor'), (req, res) => {
  try {
    const vendor = db.prepare(`
      SELECT v.*, u.name, u.email, u.phone, u.govt_id_type, u.govt_id_number, u.reputation_score
      FROM vendors v
      JOIN users u ON v.user_id = u.user_id
      WHERE v.user_id = ?
    `).get(req.user.user_id);

    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const activeJobs = getActiveJobsCount(vendor.vendor_id);
    res.json({ vendor, activeJobs });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

/**
 * PUT /api/vendors/profile
 * Update vendor profile
 */
router.put('/profile', authenticate, authorize('vendor'), (req, res) => {
  try {
    const { company_name, category, skills, latitude, longitude, address, experience_years, is_available } = req.body;

    const vendor = db.prepare('SELECT vendor_id FROM vendors WHERE user_id = ?').get(req.user.user_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    db.prepare(`
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
    `).run(
      company_name || null,
      category || null,
      skills ? JSON.stringify(skills) : null,
      latitude != null ? parseFloat(latitude) : null,
      longitude != null ? parseFloat(longitude) : null,
      address || null,
      experience_years != null ? parseInt(experience_years) : null,
      is_available != null ? (is_available ? 1 : 0) : null,
      vendor.vendor_id
    );

    // Also update user personal details if provided
    const { name, phone } = req.body;
    if (name || phone) {
      db.prepare(`
        UPDATE users SET
          name = COALESCE(?, name),
          phone = COALESCE(?, phone)
        WHERE user_id = ?
      `).run(name || null, phone || null, req.user.user_id);
    }

    const updated = db.prepare('SELECT * FROM vendors WHERE vendor_id = ?').get(vendor.vendor_id);
    res.json({ message: 'Profile updated', vendor: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * GET /api/vendors/nearby-tenders
 * Get open tenders near the vendor's location
 */
router.get('/nearby-tenders', authenticate, authorize('vendor'), (req, res) => {
  try {
    const vendor = db.prepare('SELECT * FROM vendors WHERE user_id = ?').get(req.user.user_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
    if (!vendor.latitude || !vendor.longitude) {
      return res.status(400).json({ error: 'Update your location to see nearby tenders.' });
    }

    const radius = parseFloat(req.query.radius) || 5;

    // Get open tenders with location
    const tenders = db.prepare(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url,
             u.name as citizen_name
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.status = 'open' AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      ORDER BY mt.created_at DESC
    `).all();

    // Import haversine
    const { haversineDistance } = require('../services/vendorMatching');

    const nearbyTenders = tenders
      .map(t => ({
        ...t,
        distance: Math.round(haversineDistance(vendor.latitude, vendor.longitude, t.latitude, t.longitude) * 100) / 100
      }))
      .filter(t => t.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    // Check which tenders the vendor already applied to
    const appliedTenderIds = db.prepare(`
      SELECT tender_id FROM applications WHERE vendor_id = ?
    `).all(vendor.vendor_id).map(a => a.tender_id);

    const result = nearbyTenders.map(t => ({
      ...t,
      hasApplied: appliedTenderIds.includes(t.tender_id)
    }));

    res.json({ tenders: result, vendorLocation: { lat: vendor.latitude, lon: vendor.longitude } });
  } catch (err) {
    console.error('Nearby tenders error:', err);
    res.status(500).json({ error: 'Failed to get nearby tenders.' });
  }
});

/**
 * POST /api/vendors/apply/:tenderId
 * Apply to a tender with a bid
 */
router.post('/apply/:tenderId', authenticate, authorize('vendor'), (req, res) => {
  try {
    const { bid_amount, proposal } = req.body;
    if (!bid_amount || bid_amount <= 0) {
      return res.status(400).json({ error: 'Valid bid amount is required.' });
    }

    const vendor = db.prepare('SELECT * FROM vendors WHERE user_id = ?').get(req.user.user_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const tender = db.prepare('SELECT * FROM micro_tenders WHERE tender_id = ?').get(req.params.tenderId);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });
    if (tender.status !== 'open') {
      return res.status(400).json({ error: 'Tender is no longer open.' });
    }

    // Check if already applied
    const existing = db.prepare('SELECT application_id FROM applications WHERE tender_id = ? AND vendor_id = ?')
      .get(tender.tender_id, vendor.vendor_id);
    if (existing) return res.status(409).json({ error: 'Already applied to this tender.' });

    const result = db.prepare(`
      INSERT INTO applications (tender_id, vendor_id, bid_amount, proposal)
      VALUES (?, ?, ?, ?)
    `).run(tender.tender_id, vendor.vendor_id, parseFloat(bid_amount), proposal || null);

    const application = db.prepare('SELECT * FROM applications WHERE application_id = ?')
      .get(result.lastInsertRowid);

    // Send Notification to Citizen
    const citizen = db.prepare(`
      SELECT c.user_id, c.category FROM complaints c
      JOIN micro_tenders mt ON c.complaint_id = mt.complaint_id
      WHERE mt.tender_id = ?
    `).get(tender.tender_id);

    if (citizen) {
      notifications.sendNotification(
        req.app,
        citizen.user_id,
        'New Bid Received',
        `A vendor has submitted a bid for your complaint: ${citizen.category}. Check the dashboard for details!`,
        'info'
      );
    }

    res.status(201).json({ message: 'Application submitted', application });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Failed to apply.' });
  }
});

/**
 * GET /api/vendors/my-jobs
 * Get vendor's assigned/active jobs
 */
router.get('/my-jobs', authenticate, authorize('vendor'), (req, res) => {
  try {
    const vendor = db.prepare('SELECT vendor_id FROM vendors WHERE user_id = ?').get(req.user.user_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const jobs = db.prepare(`
      SELECT mt.*, c.category, c.description, c.latitude, c.longitude, c.image_url,
             u.name as citizen_name, u.phone as citizen_phone
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      JOIN users u ON c.user_id = u.user_id
      WHERE mt.assigned_vendor_id = ?
      ORDER BY mt.created_at DESC
    `).all(vendor.vendor_id);

    const applications = db.prepare(`
      SELECT a.*, mt.status as tender_status, c.category, c.description
      FROM applications a
      JOIN micro_tenders mt ON a.tender_id = mt.tender_id
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE a.vendor_id = ?
      ORDER BY a.created_at DESC
    `).all(vendor.vendor_id);

    res.json({ jobs, applications });
  } catch (err) {
    console.error('My jobs error:', err);
    res.status(500).json({ error: 'Failed to get jobs.' });
  }
});

/**
 * GET /api/vendors/all
 * List all vendors (admin only)
 */
router.get('/all', authenticate, authorize('admin'), (req, res) => {
  try {
    const vendors = db.prepare(`
      SELECT v.*, u.name, u.email, u.phone, u.reputation_score, u.is_active
      FROM vendors v
      JOIN users u ON v.user_id = u.user_id
      ORDER BY v.rating_avg DESC
    `).all();

    res.json({ vendors });
  } catch (err) {
    console.error('List vendors error:', err);
    res.status(500).json({ error: 'Failed to list vendors.' });
  }
});

module.exports = router;
