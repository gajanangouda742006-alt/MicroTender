const db = require('../config/database');
const { haversineDistance } = require('./vendorMatching');

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function safeRatio(value, max) {
  if (!max || max <= 0) return 0;
  return value / max;
}

function normalizeCategory(category = '') {
  return category.toLowerCase().replace(/[\s-]+/g, '_');
}

function computeVendorScore(candidate, maxima, estimatedCost) {
  const ratingScore = safeRatio(candidate.rating_avg || 0, 5) * 24;
  const experienceScore = safeRatio(candidate.experience_years || 0, maxima.maxExperience) * 12;
  const proximityScore = candidate.distance_km == null
    ? 10
    : (1 - clamp(candidate.distance_km / maxima.maxDistance)) * 18;
  const completedScore = safeRatio(candidate.total_jobs_completed || 0, maxima.maxCompletedJobs) * 16;
  const successScore = clamp(candidate.bid_success_rate || 0) * 16;
  const aiBidScore = safeRatio(candidate.application_ai_score || 0, 100) * 10;
  const priceDiff = estimatedCost > 0
    ? Math.abs((candidate.bid_amount || estimatedCost) - estimatedCost) / estimatedCost
    : 0;
  const priceScore = Math.max(0, 8 - (priceDiff * 10));
  const fraudPenalty = Math.min(18, (candidate.fraud_count || 0) * 3 + (candidate.high_severity_fraud_count || 0) * 4);

  return Math.round((ratingScore + experienceScore + proximityScore + completedScore + successScore + aiBidScore + priceScore - fraudPenalty) * 10) / 10;
}

async function getRecommendedVendorsForTender(tenderId, limit = 5) {
  const tender = await db.get(`
    SELECT
      mt.tender_id,
      mt.complaint_id,
      mt.estimated_cost,
      mt.priority,
      mt.status,
      c.category,
      c.description,
      c.latitude,
      c.longitude
    FROM micro_tenders mt
    JOIN complaints c ON c.complaint_id = mt.complaint_id
    WHERE mt.tender_id = ?
  `, [tenderId]);

  if (!tender) {
    return [];
  }

  const category = normalizeCategory(tender.category);
  const candidates = await db.all(`
    SELECT
      v.vendor_id,
      v.user_id,
      COALESCE(v.company_name, u.name) AS vendor_name,
      v.company_name,
      u.name AS contact_name,
      u.phone,
      u.email,
      COALESCE(v.rating_avg, 0) AS rating_avg,
      COALESCE(v.experience_years, 0) AS experience_years,
      COALESCE(v.total_jobs_completed, 0) AS total_jobs_completed,
      COALESCE(v.vendor_score, 0) AS vendor_score,
      v.latitude,
      v.longitude,
      v.address,
      v.category,
      v.skills,
      COALESCE(app.application_id, 0) AS application_id,
      COALESCE(app.bid_amount, mt.estimated_cost) AS bid_amount,
      app.estimated_days,
      app.proposal,
      app.status AS application_status,
      COALESCE(app.ai_score, 0) AS application_ai_score,
      COALESCE(appStats.total_bids, 0) AS total_bids,
      COALESCE(appStats.accepted_bids, 0) AS accepted_bids,
      COALESCE(appStats.success_rate, 0) AS bid_success_rate,
      COALESCE(fraudStats.fraud_count, 0) AS fraud_count,
      COALESCE(fraudStats.high_severity_fraud_count, 0) AS high_severity_fraud_count
    FROM vendors v
    JOIN users u ON u.user_id = v.user_id
    JOIN micro_tenders mt ON mt.tender_id = ?
    LEFT JOIN applications app
      ON app.vendor_id = v.vendor_id
     AND app.tender_id = mt.tender_id
    LEFT JOIN (
      SELECT
        vendor_id,
        COUNT(*) AS total_bids,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted_bids,
        COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 0) AS success_rate
      FROM applications
      GROUP BY vendor_id
    ) appStats ON appStats.vendor_id = v.vendor_id
    LEFT JOIN (
      SELECT
        v2.vendor_id,
        COUNT(fl.log_id) AS fraud_count,
        SUM(CASE WHEN fl.severity IN ('high', 'critical') AND fl.resolved = 0 THEN 1 ELSE 0 END) AS high_severity_fraud_count
      FROM vendors v2
      LEFT JOIN fraud_logs fl ON fl.user_id = v2.user_id
      GROUP BY v2.vendor_id
    ) fraudStats ON fraudStats.vendor_id = v.vendor_id
    WHERE v.is_available = 1
      AND (
        app.application_id IS NOT NULL
        OR LOWER(REPLACE(COALESCE(v.category, ''), '-', '_')) = ?
        OR LOWER(COALESCE(v.skills, '')) LIKE ?
      )
    ORDER BY app.application_id DESC, v.rating_avg DESC, v.total_jobs_completed DESC
  `, [tenderId, category, `%${category}%`]);

  const enriched = candidates.map((candidate) => {
    const distance_km =
      tender.latitude != null &&
      tender.longitude != null &&
      candidate.latitude != null &&
      candidate.longitude != null
        ? Math.round(haversineDistance(tender.latitude, tender.longitude, candidate.latitude, candidate.longitude) * 100) / 100
        : null;

    return {
      ...candidate,
      distance_km,
      bid_success_rate: Number(candidate.bid_success_rate || 0),
      bid_amount: Number(candidate.bid_amount || tender.estimated_cost || 0),
    };
  });

  const maxima = {
    maxExperience: Math.max(1, ...enriched.map((candidate) => Number(candidate.experience_years || 0))),
    maxDistance: Math.max(1, ...enriched.map((candidate) => Number(candidate.distance_km || 0))),
    maxCompletedJobs: Math.max(1, ...enriched.map((candidate) => Number(candidate.total_jobs_completed || 0))),
  };

  return enriched
    .map((candidate) => {
      const ai_score = computeVendorScore(candidate, maxima, Number(tender.estimated_cost || 0));
      const recommendation_reason = [
        `${(candidate.rating_avg || 0).toFixed(1)}★ rating`,
        `${candidate.experience_years || 0} yrs experience`,
        candidate.distance_km == null ? 'distance unavailable' : `${candidate.distance_km} km away`,
        `${candidate.total_jobs_completed || 0} completed jobs`,
      ].join(' • ');

      return {
        ...candidate,
        ai_score,
        recommendation_reason,
      };
    })
    .sort((a, b) => b.ai_score - a.ai_score || a.bid_amount - b.bid_amount || a.distance_km - b.distance_km)
    .slice(0, limit);
}

module.exports = {
  getRecommendedVendorsForTender,
};
