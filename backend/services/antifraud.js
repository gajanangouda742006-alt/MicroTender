/**
 * Anti-Fraud Service
 * Implements GPS validation, duplicate detection, rate limiting,
 * image validation, reputation scoring, and vendor misuse detection.
 */

const db = require('../config/database');
const { haversineDistance } = require('./vendorMatching');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * AI-powered image validation using Gemini Vision
 * Checks if the image actually shows the reported civic issue.
 */
async function validateImageWithAI(imageUrl, category, description) {
  if (!genAI || !imageUrl) return { valid: true, confidence: 1.0, reason: 'AI disabled or no image' };

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Read image file (assuming imageUrl is a relative path like 'uploads/xxx.jpg')
    const fullPath = path.join(__dirname, '..', imageUrl);
    if (!fs.existsSync(fullPath)) return { valid: true, reason: 'Image file not found on disk' };
    
    const imageData = fs.readFileSync(fullPath).toString("base64");
    
    const prompt = `
      Analyze this image and the following complaint details:
      Category: ${category}
      Description: ${description}
      
      Tasks:
      1. Does the image depict the issue described?
      2. Is it a real photo or a fake/digitally altered image?
      3. Are there any visible red flags for fraud?
      
      Return JSON:
      {
        "isValid": boolean,
        "confidence": number (0-1),
        "issueDetected": string,
        "reasoning": string
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: "image/jpeg" // Adjust based on file extension if needed
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { valid: true, reason: 'AI returned non-JSON response' };
  } catch (error) {
    console.error('AI Image Validation Error:', error.message);
    return { valid: true, reason: 'AI validation failed, skipping check' };
  }
}

const MAX_COMPLAINTS_PER_DAY = 5;
const GPS_PROXIMITY_THRESHOLD_KM = 0.5; // 500 meters
const DUPLICATE_DESCRIPTION_THRESHOLD = 0.7;
const REPUTATION_PENALTY = 5;
const REPUTATION_REWARD = 2;

/**
 * Validate that the user is physically near the complaint location
 */
function validateGPSProximity(userLat, userLon, complaintLat, complaintLon) {
  if (!userLat || !userLon || !complaintLat || !complaintLon) {
    return { valid: true, warning: 'GPS data incomplete, skipping validation' };
  }
  const distance = haversineDistance(userLat, userLon, complaintLat, complaintLon);
  if (distance > GPS_PROXIMITY_THRESHOLD_KM) {
    return {
      valid: false,
      distance: Math.round(distance * 1000),
      message: `User is ${Math.round(distance * 1000)}m away from complaint location. Maximum allowed: ${GPS_PROXIMITY_THRESHOLD_KM * 1000}m`
    };
  }
  return { valid: true, distance: Math.round(distance * 1000) };
}

/**
 * Check rate limiting - max complaints per day per user
 */
function checkRateLimit(userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM complaints
    WHERE user_id = ? AND date(created_at) = ?
  `).get(userId, today);

  if (result.count >= MAX_COMPLAINTS_PER_DAY) {
    return {
      allowed: false,
      count: result.count,
      limit: MAX_COMPLAINTS_PER_DAY,
      message: `Rate limit exceeded. Maximum ${MAX_COMPLAINTS_PER_DAY} complaints per day.`
    };
  }
  return { allowed: true, count: result.count, remaining: MAX_COMPLAINTS_PER_DAY - result.count };
}

/**
 * Simple text similarity using Jaccard index for duplicate detection
 */
function textSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Check for duplicate complaints (same area + similar description)
 */
function checkDuplicateComplaint(userId, description, latitude, longitude) {
  const recentComplaints = db.prepare(`
    SELECT complaint_id, description, latitude, longitude FROM complaints
    WHERE status NOT IN ('completed', 'rejected')
      AND created_at > datetime('now', '-30 days')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
  `).all();

  const duplicates = [];
  for (const complaint of recentComplaints) {
    const distance = haversineDistance(latitude, longitude, complaint.latitude, complaint.longitude);
    const similarity = textSimilarity(description, complaint.description);

    if (distance < 0.1 && similarity > DUPLICATE_DESCRIPTION_THRESHOLD) {
      duplicates.push({
        complaint_id: complaint.complaint_id,
        distance: Math.round(distance * 1000),
        similarity: Math.round(similarity * 100),
        description: complaint.description.substring(0, 100)
      });
    }
  }

  return {
    isDuplicate: duplicates.length > 0,
    duplicates,
    message: duplicates.length > 0
      ? `Found ${duplicates.length} similar complaint(s) in the same area`
      : 'No duplicates detected'
  };
}

/**
 * Basic image duplicate check using filename hash
 */
function checkDuplicateImage(imageUrl) {
  if (!imageUrl) return { isDuplicate: false };

  const existing = db.prepare(`
    SELECT complaint_id FROM complaints
    WHERE image_url = ? AND status NOT IN ('completed', 'rejected')
  `).get(imageUrl);

  return {
    isDuplicate: !!existing,
    existingComplaintId: existing?.complaint_id,
    message: existing ? 'This image has already been submitted' : 'Image is unique'
  };
}

/**
 * Update user reputation score
 */
function updateReputation(userId, action) {
  let change = 0;
  switch (action) {
    case 'valid_complaint': change = REPUTATION_REWARD; break;
    case 'completed_job': change = REPUTATION_REWARD * 2; break;
    case 'false_complaint': change = -REPUTATION_PENALTY * 2; break;
    case 'duplicate_complaint': change = -REPUTATION_PENALTY; break;
    case 'rate_limit_hit': change = -REPUTATION_PENALTY / 2; break;
    case 'good_rating': change = REPUTATION_REWARD; break;
    case 'bad_rating': change = -REPUTATION_PENALTY; break;
    default: change = 0;
  }

  if (change !== 0) {
    db.prepare(`
      UPDATE users SET reputation_score = MAX(0, MIN(100, reputation_score + ?))
      WHERE user_id = ?
    `).run(change, userId);
  }

  return change;
}

/**
 * Get user reputation score
 */
function getReputation(userId) {
  const user = db.prepare('SELECT reputation_score FROM users WHERE user_id = ?').get(userId);
  return user ? user.reputation_score : 0;
}

/**
 * Detect vendor misuse patterns
 */
function detectVendorMisuse(vendorId) {
  const alerts = [];

  // Check for abnormally high bid amounts
  const avgBid = db.prepare(`
    SELECT AVG(bid_amount) as avg_bid FROM applications WHERE vendor_id = ?
  `).get(vendorId);

  const recentBids = db.prepare(`
    SELECT a.bid_amount, mt.estimated_cost
    FROM applications a
    JOIN micro_tenders mt ON a.tender_id = mt.tender_id
    WHERE a.vendor_id = ? AND a.created_at > datetime('now', '-7 days')
  `).all(vendorId);

  for (const bid of recentBids) {
    if (bid.estimated_cost && bid.bid_amount > bid.estimated_cost * 2) {
      alerts.push({
        type: 'excessive_bid',
        severity: 'high',
        message: `Bid ₹${bid.bid_amount} is more than 2x the estimated cost ₹${bid.estimated_cost}`
      });
    }
  }

  // Check for incomplete jobs
  const incompleteJobs = db.prepare(`
    SELECT COUNT(*) as count FROM micro_tenders
    WHERE assigned_vendor_id = ? AND status = 'assigned'
      AND created_at < datetime('now', '-14 days')
  `).get(vendorId);

  if (incompleteJobs.count > 2) {
    alerts.push({
      type: 'stale_assignments',
      severity: 'medium',
      message: `${incompleteJobs.count} assigned jobs not started within 14 days`
    });
  }

  // Check low ratings pattern
  const lowRatings = db.prepare(`
    SELECT COUNT(*) as count FROM ratings
    WHERE vendor_id = ? AND score <= 2 AND created_at > datetime('now', '-30 days')
  `).get(vendorId);

  if (lowRatings.count >= 3) {
    alerts.push({
      type: 'poor_performance',
      severity: 'high',
      message: `${lowRatings.count} low ratings (≤2 stars) in the last 30 days`
    });
  }

  return alerts;
}

/**
 * Log a fraud event
 */
function logFraudEvent(userId, type, description, severity = 'low') {
  db.prepare(`
    INSERT INTO fraud_logs (user_id, type, description, severity)
    VALUES (?, ?, ?, ?)
  `).run(userId, type, description, severity);
}

/**
 * Run all anti-fraud checks for a new complaint
 */
function runComplaintChecks(userId, description, latitude, longitude, imageUrl, userLat, userLon) {
  const results = {
    passed: true,
    warnings: [],
    blocks: []
  };

  // 1. Rate limit check
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    results.passed = false;
    results.blocks.push(rateCheck.message);
    logFraudEvent(userId, 'rate_limit', rateCheck.message, 'medium');
    updateReputation(userId, 'rate_limit_hit');
  }

  // 2. Duplicate check
  if (latitude && longitude) {
    const dupCheck = checkDuplicateComplaint(userId, description, latitude, longitude);
    if (dupCheck.isDuplicate) {
      results.warnings.push(dupCheck.message);
      logFraudEvent(userId, 'duplicate_complaint', dupCheck.message, 'low');
    }
  }

  // 3. GPS proximity check
  if (userLat && userLon && latitude && longitude) {
    const gpsCheck = validateGPSProximity(userLat, userLon, latitude, longitude);
    if (!gpsCheck.valid) {
      results.warnings.push(gpsCheck.message);
      logFraudEvent(userId, 'gps_mismatch', gpsCheck.message, 'medium');
    }
  }

  // 4. Image duplicate check
  if (imageUrl) {
    const imgCheck = checkDuplicateImage(imageUrl);
    if (imgCheck.isDuplicate) {
      results.warnings.push(imgCheck.message);
      logFraudEvent(userId, 'duplicate_image', imgCheck.message, 'low');
    }
  }

  // 5. Reputation check
  const reputation = getReputation(userId);
  if (reputation < 30) {
    results.warnings.push(`Low reputation score: ${reputation}. Account under review.`);
    logFraudEvent(userId, 'low_reputation', `Reputation: ${reputation}`, 'high');
  }

  return results;
}

module.exports = {
  validateGPSProximity,
  checkRateLimit,
  checkDuplicateComplaint,
  checkDuplicateImage,
  updateReputation,
  getReputation,
  detectVendorMisuse,
  logFraudEvent,
  runComplaintChecks,
  validateImageWithAI
};
