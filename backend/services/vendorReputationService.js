const db = require('../config/database');

async function refreshVendorMetrics(vendorId) {
  const [ratingStats, completedStats, fraudStats, reworkStats] = await Promise.all([
    db.get(`
      SELECT
        COALESCE(AVG(score), 0) AS rating_avg,
        COUNT(*) AS total_ratings
      FROM ratings
      WHERE vendor_id = ?
    `, [vendorId]),
    db.get(`
      SELECT COUNT(*) AS completed_jobs
      FROM micro_tenders
      WHERE assigned_vendor_id = ?
        AND verification_status = 'verified'
    `, [vendorId]),
    db.get(`
      SELECT COUNT(*) AS fraud_count
      FROM fraud_logs
      WHERE user_id = (SELECT user_id FROM vendors WHERE vendor_id = ?)
    `, [vendorId]),
    db.get(`
      SELECT COUNT(*) AS rework_count
      FROM completion_proofs
      WHERE vendor_id = ?
        AND status IN ('rejected', 'rework_requested')
    `, [vendorId]),
  ]);

  const ratingAvg = Math.round(Number(ratingStats?.rating_avg || 0) * 10) / 10;
  const totalRatings = Number(ratingStats?.total_ratings || 0);
  const completedJobs = Number(completedStats?.completed_jobs || 0);
  const fraudCount = Number(fraudStats?.fraud_count || 0);
  const reworkCount = Number(reworkStats?.rework_count || 0);
  const vendorScore = Math.max(
    0,
    Math.round(((ratingAvg * 20) + (completedJobs * 2.5) + (totalRatings * 0.5) - (fraudCount * 10) - (reworkCount * 4)) * 10) / 10
  );

  await db.run(`
    UPDATE vendors
    SET
      rating_avg = ?,
      total_ratings = ?,
      total_jobs_completed = ?,
      vendor_score = ?
    WHERE vendor_id = ?
  `, [ratingAvg, totalRatings, completedJobs, vendorScore, vendorId]);

  return db.get(`
    SELECT
      vendor_id,
      company_name,
      rating_avg,
      total_ratings,
      total_jobs_completed,
      vendor_score
    FROM vendors
    WHERE vendor_id = ?
  `, [vendorId]);
}

module.exports = {
  refreshVendorMetrics,
};
