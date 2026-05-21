const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { autoSelectVendors, findNearbyVendors } = require('../services/vendorMatching');
const { detectVendorMisuse, logFraudEvent } = require('../services/antifraud');
const { estimateCost } = require('../services/costEstimation');
const { getRecommendedVendorsForTender } = require('../services/vendorRecommendationService');
const {
  assignTenderToVendor,
  reviewCompletion,
  getComplaintLifecycleDetails,
} = require('../services/complaintLifecycleService');
const notifications = require('./notifications');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      { count: totalComplaints },
      { count: pendingComplaints },
      { count: activeComplaints },
      { count: completedComplaints },
      { count: totalTenders },
      { count: openTenders },
      { count: assignedTenders },
      { count: completedTenders },
      { count: totalVendors },
      { count: totalCitizens },
      { count: totalApplications },
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM complaints'),
      db.get("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'"),
      db.get("SELECT COUNT(*) as count FROM complaints WHERE status IN ('tender_created','assigned','in_progress')"),
      db.get("SELECT COUNT(*) as count FROM complaints WHERE status = 'completed'"),
      db.get('SELECT COUNT(*) as count FROM micro_tenders'),
      db.get("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'open'"),
      db.get("SELECT COUNT(*) as count FROM micro_tenders WHERE status IN ('assigned','in_progress')"),
      db.get("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'completed'"),
      db.get('SELECT COUNT(*) as count FROM vendors'),
      db.get("SELECT COUNT(*) as count FROM users WHERE role = 'citizen'"),
      db.get('SELECT COUNT(*) as count FROM applications'),
    ]);

    const categoryStats = await db.all(`
      SELECT category, COUNT(*) as count,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM complaints GROUP BY category ORDER BY count DESC
    `, []);

    const priorityStats = await db.all(
      'SELECT priority, COUNT(*) as count FROM micro_tenders GROUP BY priority', []
    );

    const monthlyTrend = await db.all(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM complaints
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `, []);

    const topVendors = await db.all(`
      SELECT v.vendor_id, v.company_name, v.rating_avg, v.total_jobs_completed, u.name as vendor_name
      FROM vendors v JOIN users u ON v.user_id = u.user_id
      ORDER BY v.rating_avg DESC, v.total_jobs_completed DESC LIMIT 10
    `, []);

    const { total: totalEstimatedCost } = await db.get('SELECT COALESCE(SUM(estimated_cost),0) as total FROM micro_tenders');
    const { total: totalManualCost } = await db.get('SELECT COALESCE(SUM(manual_cost),0) as total FROM micro_tenders WHERE manual_cost IS NOT NULL');
    const { avg: avgBidAmount } = await db.get('SELECT COALESCE(AVG(bid_amount),0) as avg FROM applications');

    const aiComplaints = await db.all('SELECT ai_analysis FROM complaints WHERE ai_analysis IS NOT NULL', []);
    const aiData = aiComplaints.map(c => { try { return JSON.parse(c.ai_analysis); } catch(e) { return {}; } });

    const avgAiConfidence = aiData.length > 0
      ? aiData.reduce((acc, curr) => acc + (curr.confidenceScore || 0), 0) / aiData.length : 0;

    const departmentDistribution = aiData.reduce((acc, curr) => {
      if (curr.department) acc[curr.department] = (acc[curr.department] || 0) + 1;
      return acc;
    }, {});

    const riskDistribution = aiData.reduce((acc, curr) => {
      acc[curr.riskLevel] = (acc[curr.riskLevel] || 0) + 1;
      return acc;
    }, { low: 0, medium: 0, high: 0 });

    const fraudAlerts = await db.all(`
      SELECT fl.*, u.name as user_name
      FROM fraud_logs fl
      LEFT JOIN users u ON fl.user_id = u.user_id
      WHERE fl.resolved = 0
      ORDER BY fl.created_at DESC LIMIT 20
    `, []);

    // Calculate Enterprise AI Fraud Score (System Risk Index)
    const activeAlertsCount = await db.all(`
      SELECT severity, COUNT(*) as count 
      FROM fraud_logs 
      WHERE resolved = 0 
      GROUP BY severity
    `, []);

    let calculatedRisk = 0;
    activeAlertsCount.forEach(row => {
      if (row.severity === 'critical') calculatedRisk += row.count * 20;
      else if (row.severity === 'high') calculatedRisk += row.count * 10;
      else if (row.severity === 'medium') calculatedRisk += row.count * 4;
      else calculatedRisk += row.count * 1;
    });
    const systemRiskScore = Math.min(100, Math.max(0, calculatedRisk));

    // Identify suspicious vendors dynamically using the anti-fraud misuse engine
    const suspiciousVendors = [];
    const allVendors = await db.all('SELECT v.vendor_id, v.company_name, v.rating_avg, u.name as vendor_name FROM vendors v JOIN users u ON v.user_id = u.user_id', []);
    for (const vendor of allVendors) {
      const alerts = await detectVendorMisuse(vendor.vendor_id);
      if (alerts.length > 0) {
        suspiciousVendors.push({
          vendor_id: vendor.vendor_id,
          company_name: vendor.company_name || vendor.vendor_name,
          rating_avg: vendor.rating_avg,
          alerts
        });
      }
    }

    // Locate high-risk zones based on active fraud logs
    const highRiskZones = await db.all(`
      SELECT ROUND(c.latitude, 4) as lat, ROUND(c.longitude, 4) as lon,
             COUNT(fl.log_id) as alert_count,
             MAX(fl.severity) as max_severity,
             MIN(c.category) as category
      FROM complaints c
      JOIN fraud_logs fl ON c.user_id = fl.user_id
      WHERE fl.resolved = 0
      GROUP BY lat, lon
      ORDER BY alert_count DESC LIMIT 5
    `, []);

// GET /api/admin/dashboard
// ... existing dashboard code ...
    res.json({
      overview: {
        totalComplaints, pendingComplaints, activeComplaints, completedComplaints,
        totalTenders, openTenders, assignedTenders, completedTenders,
        totalVendors, totalCitizens, totalApplications
      },
      categoryStats, priorityStats, monthlyTrend, topVendors,
      costs: { totalEstimatedCost, totalManualCost, avgBidAmount },
      fraudAlerts,
      aiAnalytics: { 
        avgAiConfidence, 
        departmentDistribution, 
        riskDistribution, 
        totalAnalyzed: aiData.length,
        systemRiskScore,
        suspiciousVendors,
        highRiskZones
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

const { approveComplaint, rejectComplaint } = require('../services/complaintService');

// POST /api/admin/complaint/:id/approve
router.post('/complaint/:id/approve', async (req, res) => {
  try {
    const tender = await approveComplaint(req.app, req.params.id);
    res.json({ message: 'Complaint approved and tender created', tender });
  } catch (err) {
    console.error('Approve complaint error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve complaint.' });
  }
});

// POST /api/admin/complaint/:id/reject
router.post('/complaint/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await rejectComplaint(req.app, req.params.id, reason);
    res.json(result);
  } catch (err) {
    console.error('Reject complaint error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject complaint.' });
  }
});

// POST /api/admin/assign-vendor
router.post('/assign-vendor', async (req, res) => {
  try {
    const { tender_id, vendor_id, notes, mode } = req.body;
    if (!tender_id || !vendor_id)
      return res.status(400).json({ error: 'Tender ID and Vendor ID are required.' });
    const result = await assignTenderToVendor({
      app: req.app,
      tenderId: tender_id,
      vendorId: vendor_id,
      adminId: req.user.user_id,
      notes,
      mode: mode || 'manual',
    });

    res.json({ message: 'Vendor assigned successfully', assignment: result });
  } catch (err) {
    console.error('Assign vendor error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to assign vendor.' });
  }
});

// PUT /api/admin/tenders/:id/verify
router.put('/tenders/:id/verify', async (req, res) => {
  try {
    await reviewCompletion({
      app: req.app,
      tenderId: req.params.id,
      action: 'approve',
      adminId: req.user.user_id,
      notes: req.body?.notes || '',
    });
    res.json({ message: 'Tender verified successfully', success: true });
  } catch (err) {
    console.error('Verify tender error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to verify tender.' });
  }
});

// POST /api/admin/verify-completion
router.post('/verify-completion', async (req, res) => {
  try {
    const { tender_id, action, notes } = req.body;
    if (!tender_id || !action) {
      return res.status(400).json({ error: 'tender_id and action are required.' });
    }

    await reviewCompletion({
      app: req.app,
      tenderId: tender_id,
      action,
      adminId: req.user.user_id,
      notes: notes || '',
    });

    res.json({ success: true, message: 'Completion review updated.' });
  } catch (err) {
    console.error('Verify completion error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update completion review.' });
  }
});

// GET /api/admin/complaints/:id
router.get('/complaints/:id', async (req, res) => {
  try {
    const data = await getComplaintLifecycleDetails(req.params.id);
    if (!data) return res.status(404).json({ error: 'Complaint not found.' });
    res.json(data);
  } catch (err) {
    console.error('Admin complaint detail error:', err);
    res.status(500).json({ error: 'Failed to get complaint details.' });
  }
});

// POST /api/admin/tenders/:id/auto-assign-applications
router.post('/tenders/:id/auto-assign-applications', async (req, res) => {
  try {
    const tenderId = req.params.id;
    const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [tenderId]);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });
    if (tender.assigned_vendor_id) return res.status(400).json({ error: 'Tender already assigned.' });

    const applications = await db.all(`
      SELECT a.*, v.rating_avg, v.experience_years, v.total_jobs_completed
      FROM applications a
      JOIN vendors v ON a.vendor_id = v.vendor_id
      WHERE a.tender_id = ? AND a.status = 'pending'
    `, [tenderId]);

    if (applications.length === 0) {
      return res.status(400).json({ error: 'No pending applications to choose from.' });
    }

    // AI Scoring logic
    const maxExp = Math.max(...applications.map(a => a.experience_years)) || 1;
    const minBid = Math.min(...applications.map(a => a.bid_amount)) || 1;
    
    let bestApp = null;
    let maxScore = -1;

    for (const app of applications) {
      const ratingScore = (app.rating_avg / 5) * 40; 
      const bidScore = (minBid / app.bid_amount) * 35; 
      const expScore = (app.experience_years / maxExp) * 25;
      const score = ratingScore + bidScore + expScore;
      
      if (score > maxScore) {
        maxScore = score;
        bestApp = app;
      }
    }

    const vendor_id = bestApp.vendor_id;
    await db.run("UPDATE micro_tenders SET assigned_vendor_id = ?, status = 'assigned' WHERE tender_id = ?", [vendor_id, tenderId]);
    await db.run("UPDATE complaints SET status = 'assigned', updated_at = NOW() WHERE complaint_id = ?", [tender.complaint_id]);
    await db.run("UPDATE applications SET status = 'accepted' WHERE tender_id = ? AND vendor_id = ?", [tenderId, vendor_id]);
    await db.run("UPDATE applications SET status = 'rejected' WHERE tender_id = ? AND vendor_id != ?", [tenderId, vendor_id]);

    const citizen = await db.get("SELECT c.user_id FROM complaints c WHERE c.complaint_id = ?", [tender.complaint_id]);
    if (citizen) {
      await notifications.sendNotification(req.app, citizen.user_id, 'Vendor Assigned', 'A vendor has been auto-assigned to resolve your issue.', 'success');
    }

    const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [vendor_id]);
    if (vendorUser) {
      await notifications.sendNotification(req.app, vendorUser.user_id, 'Bid Accepted', 'Congratulations! Your bid was auto-selected.', 'success');
    }

    for(const app of applications) {
      if (app.vendor_id !== vendor_id) {
         const user = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [app.vendor_id]);
         if(user) {
           await notifications.sendNotification(req.app, user.user_id, 'Bid Rejected', 'Your bid was not selected for this tender.', 'info');
         }
      }
    }

    res.json({ message: 'Vendor auto-assigned successfully', assigned_vendor_id: vendor_id });
  } catch (err) {
    console.error('Auto assign error:', err);
    res.status(500).json({ error: 'Failed to auto-assign vendor.' });
  }
});

// POST /api/admin/auto-assign/:tenderId
router.post('/auto-assign/:tenderId', async (req, res) => {
  try {
    const recommendations = await getRecommendedVendorsForTender(req.params.tenderId, 5);
    if (recommendations.length === 0) {
      return res.status(404).json({ error: 'No eligible vendors found.' });
    }

    const bestVendor = recommendations[0];
    await assignTenderToVendor({
      app: req.app,
      tenderId: req.params.tenderId,
      vendorId: bestVendor.vendor_id,
      adminId: req.user.user_id,
      notes: 'Auto-assigned using lifecycle recommendation engine',
      mode: 'auto',
    });

    res.json({
      message: 'Auto-assigned to best matching vendor',
      assignedVendor: bestVendor,
      candidates: recommendations,
    });
  } catch (err) {
    console.error('Auto-assign error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to auto-assign.' });
  }
});

// PATCH /api/admin/tender/:id/cost
router.patch('/tender/:id/cost', async (req, res) => {
  try {
    const { manual_cost, selected_cost_type } = req.body;
    const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [req.params.id]);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    await db.run(`
      UPDATE micro_tenders SET
        manual_cost = COALESCE(?, manual_cost),
        selected_cost_type = COALESCE(?, selected_cost_type)
      WHERE tender_id = ?
    `, [manual_cost != null ? parseFloat(manual_cost) : null, selected_cost_type || null, tender.tender_id]);

    res.json({ message: 'Cost updated' });
  } catch (err) {
    console.error('Update cost error:', err);
    res.status(500).json({ error: 'Failed to update cost.' });
  }
});

// POST /api/admin/action/:tenderId
router.post('/action/:tenderId', async (req, res) => {
  try {
    const { action, notes } = req.body;
    const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [req.params.tenderId]);
    if (!tender) return res.status(404).json({ error: 'Tender not found.' });

    switch (action) {
      case 'reassign':
        await db.run("UPDATE micro_tenders SET assigned_vendor_id = NULL, status = 'open' WHERE tender_id = ?", [tender.tender_id]);
        await db.run("UPDATE complaints SET status = 'tender_created', admin_notes = ?, updated_at = NOW() WHERE complaint_id = ?",
          [notes || 'Reassigned by admin', tender.complaint_id]);
        break;
      case 'cancel':
        await db.run("UPDATE micro_tenders SET status = 'cancelled' WHERE tender_id = ?", [tender.tender_id]);
        await db.run("UPDATE complaints SET status = 'rejected', admin_notes = ?, updated_at = NOW() WHERE complaint_id = ?",
          [notes || 'Cancelled by admin', tender.complaint_id]);
        break;
      case 'warn_vendor':
        if (tender.assigned_vendor_id) {
          const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [tender.assigned_vendor_id]);
          if (vendorUser) await logFraudEvent(vendorUser.user_id, 'admin_warning', notes || 'Admin warning for incomplete work', 'medium');
        }
        break;
      case 'complete':
        await db.run("UPDATE micro_tenders SET status = 'completed' WHERE tender_id = ?", [tender.tender_id]);
        await db.run("UPDATE complaints SET status = 'completed', updated_at = NOW() WHERE complaint_id = ?", [tender.complaint_id]);
        if (tender.assigned_vendor_id) {
          await db.run('UPDATE vendors SET total_jobs_completed = total_jobs_completed + 1 WHERE vendor_id = ?', [tender.assigned_vendor_id]);
          const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [tender.assigned_vendor_id]);
          if(vendorUser) {
             await notifications.sendNotification(req.app, vendorUser.user_id, 'Payment Released', 'Payment has been released successfully.', 'success');
          }
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

// GET /api/admin/fraud-alerts
router.get('/fraud-alerts', async (req, res) => {
  try {
    const { resolved } = req.query;
    let query = `
      SELECT fl.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM fraud_logs fl LEFT JOIN users u ON fl.user_id = u.user_id
    `;
    const params = [];
    if (resolved !== undefined) { query += ' WHERE fl.resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }
    query += ' ORDER BY fl.created_at DESC';
    const alerts = await db.all(query, params);
    res.json({ alerts });
  } catch (err) {
    console.error('Fraud alerts error:', err);
    res.status(500).json({ error: 'Failed to get fraud alerts.' });
  }
});

// PATCH /api/admin/fraud-alerts/:id/resolve
router.patch('/fraud-alerts/:id/resolve', async (req, res) => {
  try {
    await db.run('UPDATE fraud_logs SET resolved = 1 WHERE log_id = ?', [req.params.id]);
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

// GET /api/admin/vendor/:id/details
router.get('/vendor/:id/details', async (req, res) => {
  try {
    const vendor = await db.get(`
      SELECT v.*, u.name, u.email, u.phone, u.reputation_score, u.is_active, u.govt_id_type, u.govt_id_number
      FROM vendors v JOIN users u ON v.user_id = u.user_id WHERE v.vendor_id = ?
    `, [req.params.id]);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    const jobs = await db.all(`
      SELECT mt.*, c.category, c.description FROM micro_tenders mt
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE mt.assigned_vendor_id = ? ORDER BY mt.created_at DESC
    `, [vendor.vendor_id]);

    const applications = await db.all(`
      SELECT a.*, c.category, c.description FROM applications a
      JOIN micro_tenders mt ON a.tender_id = mt.tender_id
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      WHERE a.vendor_id = ? ORDER BY a.created_at DESC
    `, [vendor.vendor_id]);

    const ratings = await db.all(`
      SELECT r.*, u.name as citizen_name FROM ratings r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.vendor_id = ? ORDER BY r.created_at DESC
    `, [vendor.vendor_id]);

    const misuseAlerts = await detectVendorMisuse(vendor.vendor_id);
    res.json({ vendor, jobs, applications, ratings, misuseAlerts });
  } catch (err) {
    console.error('Vendor details error:', err);
    res.status(500).json({ error: 'Failed to get vendor details.' });
  }
});

// GET /api/admin/nearby-vendors
router.get('/nearby-vendors', async (req, res) => {
  try {
    const { lat, lon, category, radius } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Latitude and longitude required.' });
    const vendors = await findNearbyVendors(parseFloat(lat), parseFloat(lon), category || null, parseFloat(radius) || 5);
    res.json({ vendors });
  } catch (err) {
    console.error('Nearby vendors error:', err);
    res.status(500).json({ error: 'Failed to find nearby vendors.' });
  }
});

// GET /api/admin/verifications - Fetch all vendor progress updates and their AI photo inspections
router.get('/verifications', async (req, res) => {
  try {
    const verifications = await db.all(`
      SELECT wu.*, 
             v.company_name, 
             u.name as vendor_name,
             mt.priority as tender_priority,
             c.category,
             c.description as complaint_description,
             c.image_url as before_image_url
      FROM work_updates wu
      JOIN vendors v ON wu.vendor_id = v.vendor_id
      JOIN users u ON v.user_id = u.user_id
      JOIN micro_tenders mt ON wu.tender_id = mt.tender_id
      JOIN complaints c ON mt.complaint_id = c.complaint_id
      ORDER BY wu.created_at DESC
    `, []);
    res.json({ verifications });
  } catch (err) {
    console.error('Verifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch verifications.' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM dashboard_activity ORDER BY created_at DESC LIMIT 20');
    res.json({ logs });
  } catch (err) {
    console.error('Activity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
