const db = require('../config/database');
const { detectVendorMisuse, logFraudEvent } = require('./antifraud');

/** Helper to run a query and return count */
async function getCount(query, params = []) {
  const row = await db.get(query, params);
  return row ? row.count : 0;
}

/** Overview metrics */
async function getOverviewMetrics() {
  const [totalComplaints, pendingComplaints, activeComplaints, completedComplaints,
    totalTenders, openTenders, assignedTenders, completedTenders,
    totalVendors, totalCitizens, totalApplications] = await Promise.all([
    getCount('SELECT COUNT(*) as count FROM complaints'),
    getCount("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'"),
    getCount("SELECT COUNT(*) as count FROM complaints WHERE status IN ('tender_created','assigned','in_progress')"),
    getCount("SELECT COUNT(*) as count FROM complaints WHERE status = 'completed'"),
    getCount('SELECT COUNT(*) as count FROM micro_tenders'),
    getCount("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'open'"),
    getCount("SELECT COUNT(*) as count FROM micro_tenders WHERE status IN ('assigned','in_progress')"),
    getCount("SELECT COUNT(*) as count FROM micro_tenders WHERE status = 'completed'"),
    getCount('SELECT COUNT(*) as count FROM vendors'),
    getCount("SELECT COUNT(*) as count FROM users WHERE role = 'citizen'"),
    getCount('SELECT COUNT(*) as count FROM applications')
  ]);
  return { totalComplaints, pendingComplaints, activeComplaints, completedComplaints,
    totalTenders, openTenders, assignedTenders, completedTenders,
    totalVendors, totalCitizens, totalApplications };
}

/** Category statistics for complaints */
async function getCategoryStats() {
  return db.all(`
    SELECT category, COUNT(*) as count,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM complaints GROUP BY category ORDER BY count DESC`
  );
}

/** Priority stats for micro tenders */
async function getPriorityStats() {
  return db.all('SELECT priority, COUNT(*) as count FROM micro_tenders GROUP BY priority');
}

/** Monthly trend for complaints (last 6 months) */
async function getMonthlyTrend() {
  return db.all(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
    FROM complaints
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month ORDER BY month`
  );
}

/** Top vendors based on rating and job count */
async function getTopVendors(limit = 10) {
  return db.all(`
    SELECT v.vendor_id, v.company_name, v.rating_avg, v.total_jobs_completed, u.name as vendor_name
    FROM vendors v JOIN users u ON v.user_id = u.user_id
    ORDER BY v.rating_avg DESC, v.total_jobs_completed DESC LIMIT ?
  `, [limit]);
}

/** Cost aggregates */
async function getCostMetrics() {
  const { total: totalEstimatedCost } = await db.get('SELECT COALESCE(SUM(estimated_cost),0) as total FROM micro_tenders');
  const { total: totalManualCost } = await db.get('SELECT COALESCE(SUM(manual_cost),0) as total FROM micro_tenders WHERE manual_cost IS NOT NULL');
  const { avg: avgBidAmount } = await db.get('SELECT COALESCE(AVG(bid_amount),0) as avg FROM applications');
  return { totalEstimatedCost, totalManualCost, avgBidAmount };
}

/** Fraud alerts (unresolved) */
async function getFraudAlerts(limit = 20) {
  return db.all(`
    SELECT fl.*, u.name as user_name
    FROM fraud_logs fl LEFT JOIN users u ON fl.user_id = u.user_id
    WHERE fl.resolved = 0 ORDER BY fl.created_at DESC LIMIT ?
  `, [limit]);
}

/** AI analytics derived from stored ai_analysis JSON */
async function getAIAnalytics() {
  const aiComplaints = await db.all('SELECT ai_analysis FROM complaints WHERE ai_analysis IS NOT NULL');
  const aiData = aiComplaints.map(c => {
    try { return JSON.parse(c.ai_analysis); } catch(e) { return {}; }
  });
  const avgAiConfidence = aiData.length ? aiData.reduce((a,b)=>a+(b.confidenceScore||0),0)/aiData.length : 0;
  const departmentDistribution = aiData.reduce((acc,c)=>{ if(c.department) acc[c.department]=(acc[c.department]||0)+1; return acc; }, {});
  const riskDistribution = aiData.reduce((acc,c)=>{ acc[c.riskLevel]=(acc[c.riskLevel]||0)+1; return acc; }, {low:0, medium:0, high:0});
  // System risk score based on active fraud alerts severity
  const alertSevs = await db.all(`
    SELECT severity, COUNT(*) as count FROM fraud_logs WHERE resolved = 0 GROUP BY severity`
  );
  let calculatedRisk = 0;
  alertSevs.forEach(row=>{
    if(row.severity==='critical') calculatedRisk += row.count*20;
    else if(row.severity==='high') calculatedRisk += row.count*10;
    else if(row.severity==='medium') calculatedRisk += row.count*4;
    else calculatedRisk += row.count*1;
  });
  const systemRiskScore = Math.min(100, Math.max(0, calculatedRisk));
  // Suspicious vendors
  const allVendors = await db.all('SELECT v.vendor_id, v.company_name, v.rating_avg, u.name as vendor_name FROM vendors v JOIN users u ON v.user_id = u.user_id');
  const suspiciousVendors = [];
  for(const vendor of allVendors){
    const alerts = await detectVendorMisuse(vendor.vendor_id);
    if(alerts.length) suspiciousVendors.push({ vendor_id: vendor.vendor_id, company_name: vendor.company_name, rating_avg: vendor.rating_avg, alerts });
  }
  // High risk zones (based on complaints linked to unresolved fraud)
  const highRiskZones = await db.all(`
    SELECT ROUND(c.latitude,4) as lat, ROUND(c.longitude,4) as lon,
           COUNT(fl.log_id) as alert_count,
           MAX(fl.severity) as max_severity,
           MIN(c.category) as category
    FROM complaints c JOIN fraud_logs fl ON c.user_id = fl.user_id
    WHERE fl.resolved = 0 GROUP BY lat, lon ORDER BY alert_count DESC LIMIT 5`
  );
  return { avgAiConfidence, departmentDistribution, riskDistribution, totalAnalyzed: aiData.length,
    systemRiskScore, suspiciousVendors, highRiskZones };
}

/** Activity logger – stores a JSON payload for dashboard feeds */
async function logActivity(type, payload) {
  const sql = `INSERT INTO dashboard_activity (type, payload, created_at) VALUES (?, ?, NOW())`;
  await db.run(sql, [type, JSON.stringify(payload)]);
}

module.exports = {
  getOverviewMetrics,
  getCategoryStats,
  getPriorityStats,
  getMonthlyTrend,
  getTopVendors,
  getCostMetrics,
  getFraudAlerts,
  getAIAnalytics,
  logActivity
};
