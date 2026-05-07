/**
 * Vendor Matching Service
 * Uses Haversine formula for distance calculation and multi-factor ranking.
 */

const db = require('../config/database');

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 5;

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Find vendors within a given radius of a location
 * @param {number} lat - Complaint latitude
 * @param {number} lon - Complaint longitude
 * @param {string} category - Complaint category
 * @param {number} radiusKm - Search radius in km (default: 5)
 * @returns {Array} Ranked list of nearby vendors
 */
function findNearbyVendors(lat, lon, category = null, radiusKm = DEFAULT_RADIUS_KM) {
  let query = `
    SELECT v.*, u.name as vendor_name, u.phone, u.email
    FROM vendors v
    JOIN users u ON v.user_id = u.user_id
    WHERE v.is_available = 1
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
  `;
  const params = [];

  if (category) {
    query += ` AND (v.category = ? OR v.skills LIKE ?)`;
    params.push(category, `%${category}%`);
  }

  const vendors = db.prepare(query).all(...params);

  // Calculate distance and filter by radius
  const nearbyVendors = vendors
    .map(vendor => {
      const distance = haversineDistance(lat, lon, vendor.latitude, vendor.longitude);
      return { ...vendor, distance: Math.round(distance * 100) / 100 };
    })
    .filter(vendor => vendor.distance <= radiusKm);

  // Rank vendors by composite score
  return rankVendors(nearbyVendors);
}

/**
 * Rank vendors by multiple factors:
 * - Distance (40% weight) - closer is better
 * - Rating (35% weight) - higher is better
 * - Availability/Jobs completed (15% weight) - experience matters
 * - Experience years (10% weight)
 */
function rankVendors(vendors) {
  if (vendors.length === 0) return [];

  const maxDistance = Math.max(...vendors.map(v => v.distance)) || 1;
  const maxJobs = Math.max(...vendors.map(v => v.total_jobs_completed)) || 1;
  const maxExp = Math.max(...vendors.map(v => v.experience_years)) || 1;

  return vendors
    .map(vendor => {
      const distanceScore = (1 - vendor.distance / maxDistance) * 40;
      const ratingScore = (vendor.rating_avg / 5) * 35;
      const jobsScore = (vendor.total_jobs_completed / maxJobs) * 15;
      const expScore = (vendor.experience_years / maxExp) * 10;
      const totalScore = Math.round((distanceScore + ratingScore + jobsScore + expScore) * 100) / 100;

      return { ...vendor, matchScore: totalScore };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Auto-select top N vendors for a tender
 */
function autoSelectVendors(lat, lon, category, topN = 3) {
  const ranked = findNearbyVendors(lat, lon, category);
  return ranked.slice(0, topN);
}

/**
 * Get vendor's active jobs count
 */
function getActiveJobsCount(vendorId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM micro_tenders
    WHERE assigned_vendor_id = ? AND status IN ('assigned', 'in_progress')
  `).get(vendorId);
  return result.count;
}

module.exports = {
  haversineDistance,
  findNearbyVendors,
  rankVendors,
  autoSelectVendors,
  getActiveJobsCount,
  DEFAULT_RADIUS_KM
};
