const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { autoSelectVendors, findNearbyVendors } = require('../services/vendorMatching');
const { detectVendorMisuse, logFraudEvent } = require('../services/antifraud');
const { estimateCost } = require('../services/costEstimation');
const notifications = require('./notifications');

const router = express.Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

/**
 * GET /api/admin/dashboard
 * Get dashboard analytics
 */
router.get('/dashboard', (req, res) => {
  try {
    const totalComplaints = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
    const pendingComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'").get().count;
    const activeComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status IN ('tender_created','assigned','in_progress')").get().count;
    const completedComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'completed'").get().count;

    const totalTenders = db.prepare('SELECT COUNT(*) as count FROM micro_tenders').get().count;
    const openTenders = db.prepare("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'open'").get().count;
    const assignedTenders = db.prepare("SELECT COUNT(*) as count FROM micro_tenders WHERE status IN ('assigned','in_progress')").get().count;
    const completedTenders = db.prepare("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'completed'").get().count;

    const totalVendors = db.prepare('SELECT COUNT(*) as count FROM vendors').get().count;
    const totalCitizens = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'citizen'").get().count;
    const totalApplications = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;

    // Category breakdown
    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM complaints GROUP BY category ORDER BY count DESC
    `).all();

    // Priority breakdown
    const priorityStats = db.prepare(`
      SELECT priority, COUNT(*) as count FROM micro_tenders GROUP BY priority
    `).all();

    // Monthly trend (last 6 months)
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM complaints
      WHERE created_at > datetime('now', '-6 months')
      GROUP BY month ORDER BY month
    `).all();

    // Top vendors
    const topVendors = db.prepare(`
      SELECT v.vendor_id, v.company_name, v.rating_avg, v.total_jobs_completed,
             u.name as vendor_name
      FROM vendors v JOIN users u ON v.user_id = u.user_id
      ORDER BY v.rating_avg DESC, v.total_jobs_completed DESC
      LIMIT 10
    `).all();

    // Cost analytics
    const totalEstimatedCost = db.prepare('SELECT SUM(estimated_cost) as total FROM micro_tenders').get().total || 0;
    const totalManualCost = db.prepare('SELECT SUM(manual_cost) as total FROM micro_tenders WHERE manual_cost IS NOT NULL').get().total || 0;
    const avgBidAmount = db.prepare('SELECT AVG(bid_amount) as avg FROM applications').get().avg || 0;

    // Recent fraud alerts
    const fraudAlerts = db.prepare(`
      SELECT fl.*, u.name as user_name
      FROM fraud_logs fl
      LEFT JOIN users u ON fl.user_id = u.user_id
      WHERE fl.resolved = 0
      ORDER BY fl.created_at DESC LIMIT 20
    `).all();

    res.json({
      overview: {
        totalComplaints, pendingComplaints, activeComplaints, completedComplaints,
        totalTenders, openTenders, assignedTenders, completedTenders,
        totalVendors, totalCitizens, totalApplications
      },
      categoryStats,
      priorityStats,
      monthlyTrend,
      topVendors,
      costs: { totalEstimatedCost, totalManualCost, avgBidAmount },
      fraudAlerts
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

/**
 * POST /api/admin/assign-vendor
 * Manually assign a vendor to a tender
 */
router.post('/assign-vendor', (req, res) => {
  try {
    const { tender_id, vendor_id } = req.body;
    if (!tender_id || !vendor_id) {
      return res.status(400).json({ error: 'Tender ID and Vendor ID are required.' });
    }

    const tender = db.prepare('SELECT * FROM micro_tenders WHERE tender_id = ?').get(tender_id);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    const vendor = db.prepare('SELECT * FROM vendors WHERE vendor_id = ?').get(vendor_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    // Update tender
    db.prepare(`
      UPDATE micro_tenders SET assigned_vendor_id = ?, status = 'assigned' WHERE tender_id = ?
    `).run(vendor_id, tender_id);

    // Update complaint status
    db.prepare(`
      UPDATE complaints SET status = 'assigned', updated_at = datetime('now') WHERE complaint_id = ?
    `).run(tender.complaint_id);

    // Update application status
    db.prepare(`UPDATE applications SET status = 'accepted' WHERE tender_id = ? AND vendor_id = ?`)
      .run(tender_id, vendor_id);
    db.prepare(`UPDATE applications SET status = 'rejected' WHERE tender_id = ? AND vendor_id != ?`)
      .run(tender_id, vendor_id);

    // Send Notifications
    const citizen = db.prepare(`
      SELECT c.user_id, c.category FROM complaints c
      WHERE c.complaint_id = ?
    `).get(tender.complaint_id);

    if (citizen) {
      notifications.sendNotification(
        req.app,
        citizen.user_id,
        'Vendor Assigned',
        `A vendor (${vendor.company_name}) has been assigned to resolve your complaint: ${citizen.category}.`,
        'success'
      );
    }

    notifications.sendNotification(
      req.app,
      vendor.user_id,
      'New Job Assigned',
      `You have been assigned to a new micro-tender for: ${citizen?.category || 'Civic Issue'}.`,
      'success'
    );

    res.json({ message: 'Vendor assigned successfully' });
  } catch (err) {
    console.error('Assign vendor error:', err);
    res.status(500).json({ error: 'Failed to assign vendor.' });
  }
});

/**
 * POST /api/admin/auto-assign/:tenderId
 * Auto-assign best matching vendor
 */
router.post('/auto-assign/:tenderId', (req, res) => {
  try {
    const tender = db.prepare(`
      SELECT mt.*, c.latitude, c.longitude, c.category
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE mt.tender_id = ?
    `).get(req.params.tenderId);

    if (!tender) return res.status(404).json({ error: 'Tender not found.' });
    if (!tender.latitude || !tender.longitude) {
      return res.status(400).json({ error: 'Complaint has no GPS location.' });
    }

    const topVendors = autoSelectVendors(tender.latitude, tender.longitude, tender.category);
    if (topVendors.length === 0) {
      return res.status(404).json({ error: 'No nearby vendors found.' });
    }

    const bestVendor = topVendors[0];

    // Assign
    db.prepare(`UPDATE micro_tenders SET assigned_vendor_id = ?, status = 'assigned' WHERE tender_id = ?`)
      .run(bestVendor.vendor_id, tender.tender_id);
    db.prepare(`UPDATE complaints SET status = 'assigned', updated_at = datetime('now') WHERE complaint_id = ?`)
      .run(tender.complaint_id);

    res.json({
      message: 'Auto-assigned to best matching vendor',
      assignedVendor: bestVendor,
      candidates: topVendors
    });
  } catch (err) {
    console.error('Auto-assign error:', err);
    res.status(500).json({ error: 'Failed to auto-assign.' });
  }
});

/**
 * PATCH /api/admin/tender/:id/cost
 * Set manual cost and select cost type
 */
router.patch('/tender/:id/cost', (req, res) => {
  try {
    const { manual_cost, selected_cost_type } = req.body;
    const tender = db.prepare('SELECT * FROM micro_tenders WHERE tender_id = ?').get(req.params.id);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    db.prepare(`
      UPDATE micro_tenders SET
        manual_cost = COALESCE(?, manual_cost),
        selected_cost_type = COALESCE(?, selected_cost_type)
      WHERE tender_id = ?
    `).run(
      manual_cost != null ? parseFloat(manual_cost) : null,
      selected_cost_type || null,
      tender.tender_id
    );

    res.json({ message: 'Cost updated' });
  } catch (err) {
    console.error('Update cost error:', err);
    res.status(500).json({ error: 'Failed to update cost.' });
  }
});

/**
 * POST /api/admin/action/:tenderId
 * Admin action on incomplete work
 */
router.post('/action/:tenderId', (req, res) => {
  try {
    const { action, notes } = req.body;
    const tender = db.prepare('SELECT * FROM micro_tenders WHERE tender_id = ?').get(req.params.tenderId);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    switch (action) {
      case 'reassign':
        db.prepare(`UPDATE micro_tenders SET assigned_vendor_id = NULL, status = 'open' WHERE tender_id = ?`)
          .run(tender.tender_id);
        db.prepare(`UPDATE complaints SET status = 'tender_created', admin_notes = ?, updated_at = datetime('now') WHERE complaint_id = ?`)
          .run(notes || 'Reassigned by admin', tender.complaint_id);
        break;
      case 'cancel':
        db.prepare(`UPDATE micro_tenders SET status = 'cancelled' WHERE tender_id = ?`)
          .run(tender.tender_id);
        db.prepare(`UPDATE complaints SET status = 'rejected', admin_notes = ?, updated_at = datetime('now') WHERE complaint_id = ?`)
          .run(notes || 'Cancelled by admin', tender.complaint_id);
        break;
      case 'warn_vendor':
        if (tender.assigned_vendor_id) {
          const vendorUser = db.prepare('SELECT user_id FROM vendors WHERE vendor_id = ?').get(tender.assigned_vendor_id);
          if (vendorUser) {
            logFraudEvent(vendorUser.user_id, 'admin_warning', notes || 'Admin warning for incomplete work', 'medium');
          }
        }
        break;
      case 'complete':
        db.prepare(`UPDATE micro_tenders SET status = 'completed' WHERE tender_id = ?`).run(tender.tender_id);
        db.prepare(`UPDATE complaints SET status = 'completed', updated_at = datetime('now') WHERE complaint_id = ?`)
          .run(tender.complaint_id);
        if (tender.assigned_vendor_id) {
          db.prepare('UPDATE vendors SET total_jobs_completed = total_jobs_completed + 1 WHERE vendor_id = ?')
            .run(tender.assigned_vendor_id);
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid action. Use: reassign, cancel, warn_vendor, complete' });
    }

    res.json({ message: `Action '${action}' performed successfully` });
  } catch (err) {
    console.error('Admin action error:', err);
    res.status(500).json({ error: 'Failed to perform action.' });
  }
});

/**
 * GET /api/admin/fraud-alerts
 * Get all fraud alerts
 */
router.get('/fraud-alerts', (req, res) => {
  try {
    const { resolved } = req.query;
    let query = `
      SELECT fl.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM fraud_logs fl
      LEFT JOIN users u ON fl.user_id = u.user_id
    `;
    const params = [];
    if (resolved !== undefined) {
      query += ' WHERE fl.resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    query += ' ORDER BY fl.created_at DESC';

    const alerts = db.prepare(query).all(...params);
    res.json({ alerts });
  } catch (err) {
    console.error('Fraud alerts error:', err);
    res.status(500).json({ error: 'Failed to get fraud alerts.' });
  }
});

/**
 * PATCH /api/admin/fraud-alerts/:id/resolve
 */
router.patch('/fraud-alerts/:id/resolve', (req, res) => {
  try {
    db.prepare('UPDATE fraud_logs SET resolved = 1 WHERE log_id = ?').run(req.params.id);
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

/**
 * GET /api/admin/vendor/:id/details
 * Get detailed vendor info including misuse detection
 */
router.get('/vendor/:id/details', (req, res) => {
  try {
    const vendor = db.prepare(`
      SELECT v.*, u.name, u.email, u.phone, u.reputation_score, u.is_active,
             u.govt_id_type, u.govt_id_number
      FROM vendors v JOIN users u ON v.user_id = u.user_id
      WHERE v.vendor_id = ?
    `).get(req.params.id);

    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    const jobs = db.prepare(`
      SELECT mt.*, c.category, c.description
      FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE mt.assigned_vendor_id = ?
      ORDER BY mt.created_at DESC
    `).all(vendor.vendor_id);

    const applications = db.prepare(`
      SELECT a.*, c.category, c.description
      FROM applications a
      JOIN micro_tenders mt ON a.tender_id = mt.tender_id
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE a.vendor_id = ?
      ORDER BY a.created_at DESC
    `).all(vendor.vendor_id);

    const ratings = db.prepare(`
      SELECT r.*, u.name as citizen_name
      FROM ratings r JOIN users u ON r.user_id = u.user_id
      WHERE r.vendor_id = ?
      ORDER BY r.created_at DESC
    `).all(vendor.vendor_id);

    const misuseAlerts = detectVendorMisuse(vendor.vendor_id);

    res.json({ vendor, jobs, applications, ratings, misuseAlerts });
  } catch (err) {
    console.error('Vendor details error:', err);
    res.status(500).json({ error: 'Failed to get vendor details.' });
  }
});

/**
 * GET /api/admin/nearby-vendors
 * Find vendors near a location
 */
router.get('/nearby-vendors', (req, res) => {
  try {
    const { lat, lon, category, radius } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Latitude and longitude required.' });

    const vendors = findNearbyVendors(
      parseFloat(lat), parseFloat(lon),
      category || null, parseFloat(radius) || 5
    );
    res.json({ vendors });
  } catch (err) {
    console.error('Nearby vendors error:', err);
    res.status(500).json({ error: 'Failed to find nearby vendors.' });
  }
});

module.exports = router;
