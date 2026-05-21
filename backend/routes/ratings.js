const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { updateReputation } = require('../services/antifraud');
const { analyzeReviewSentiment } = require('../services/aiAnalyzer');
const { refreshVendorMetrics } = require('../services/vendorReputationService');
const notifications = require('./notifications');

const router = express.Router();

// POST /api/ratings
router.post('/', authenticate, authorize('citizen'), async (req, res) => {
  try {
    const { complaint_id, score, feedback, rating, review } = req.body;
    const user_id = req.user.user_id;
    const finalScore = Number(score || rating);
    const finalFeedback = feedback ?? review ?? null;

    if (!complaint_id) {
      return res.status(400).json({ error: 'Complaint ID is required.' });
    }
    if (!finalScore || finalScore < 1 || finalScore > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5.' });
    }

    const complaint = await db.get(
      'SELECT * FROM complaints WHERE complaint_id = ? AND user_id = ?',
      [complaint_id, user_id]
    );
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    if (complaint.status !== 'completed') {
      return res.status(400).json({ error: 'Vendor rating can only be submitted after the complaint is marked as completed.' });
    }

    const tender = await db.get(
      'SELECT * FROM micro_tenders WHERE complaint_id = ?',
      [complaint_id]
    );
    if (!tender || !tender.assigned_vendor_id) {
      return res.status(400).json({ error: 'No vendor assigned to this complaint.' });
    }
    if (tender.verification_status !== 'verified') {
      return res.status(400).json({ error: 'Work must be verified by admin before review.' });
    }

    const vendor_id = tender.assigned_vendor_id;
    const existing = await db.get(
      'SELECT rating_id FROM ratings WHERE complaint_id = ? AND user_id = ?',
      [complaint_id, user_id]
    );
    if (existing) {
      return res.status(409).json({ error: 'You have already rated the vendor for this complaint.' });
    }

    let sentiment = 'neutral';
    if (analyzeReviewSentiment && finalFeedback) {
      try {
        sentiment = await analyzeReviewSentiment(finalFeedback);
      } catch (error) {
        console.warn('Sentiment analysis failed:', error);
      }
    }

    const ratingResult = await db.run(
      'INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback, ai_sentiment, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vendor_id, complaint_id, user_id, finalScore, finalFeedback, sentiment, true]
    );

    await db.run(
      'INSERT INTO vendor_reviews (rating_id, vendor_id, complaint_id, user_id, rating, review) VALUES (?, ?, ?, ?, ?, ?)',
      [ratingResult.insertId, vendor_id, complaint_id, user_id, finalScore, finalFeedback]
    );

    const updatedVendor = await refreshVendorMetrics(vendor_id);

    if (updateReputation) {
      try {
        await updateReputation(user_id, finalScore >= 3 ? 'good_rating' : 'bad_rating');
      } catch (error) {
        console.warn('Reputation update failed:', error);
      }
    }

    const io = req.app.get('io');
    if (io) {
      const payload = {
        complaint_id,
        vendor_id,
        rating_avg: updatedVendor.rating_avg,
        total_ratings: updatedVendor.total_ratings,
        vendor_score: updatedVendor.vendor_score,
      };
      io.emit('rating_updated', payload);
      io.emit('citizen_review_submitted', payload);
      io.emit('vendor_rating_updated', payload);
      io.to(`complaint_${complaint_id}`).emit('citizen_review_submitted', payload);
    }

    try {
      const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [vendor_id]);
      if (vendorUser) {
        await notifications.sendNotification(req.app, vendorUser.user_id, {
          title: 'New Review Received',
          message: `A citizen rated your work ${finalScore}/5 stars.`,
          type: 'success',
          action_url: '/vendor/reviews',
          metadata: { complaint_id, vendor_id, rating_id: ratingResult.insertId },
        });
      }
    } catch (error) {
      console.warn('Vendor notification failed:', error);
    }

    res.status(201).json({
      message: 'Thank you for your rating!',
      rating: {
        vendor_id,
        complaint_id,
        user_id,
        score: finalScore,
        feedback: finalFeedback,
        created_at: new Date(),
      },
      updatedStats: updatedVendor,
    });
  } catch (err) {
    console.error('Rating submission failed:', err);
    res.status(500).json({ error: 'Failed to submit rating.' });
  }
});

// GET /api/ratings/mine - Logged-in vendor review feed
router.get('/mine', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await db.get('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.user_id]);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found.' });
    }

    const reviews = await db.all(`
      SELECT
        vr.vendor_review_id,
        vr.rating,
        vr.review,
        vr.created_at,
        u.name AS citizen_name,
        c.category,
        c.description,
        c.complaint_id
      FROM vendor_reviews vr
      JOIN users u ON u.user_id = vr.user_id
      JOIN complaints c ON c.complaint_id = vr.complaint_id
      WHERE vr.vendor_id = ?
      ORDER BY vr.created_at DESC
    `, [vendor.vendor_id]);

    const vendorSummary = await db.get(`
      SELECT vendor_id, company_name, rating_avg, total_ratings, total_jobs_completed, vendor_score
      FROM vendors
      WHERE vendor_id = ?
    `, [vendor.vendor_id]);

    res.json({ vendor: vendorSummary, reviews });
  } catch (err) {
    console.error('Vendor review feed failed:', err);
    res.status(500).json({ error: 'Failed to fetch vendor reviews.' });
  }
});

// GET /api/ratings/vendor/:vendorId
router.get('/vendor/:vendorId', authenticate, async (req, res) => {
  try {
    const { vendorId } = req.params;

    const reviews = await db.all(`
      SELECT
        r.rating_id,
        r.score,
        r.feedback,
        r.created_at,
        u.name AS citizen_name
      FROM ratings r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.vendor_id = ?
      ORDER BY r.created_at DESC
    `, [vendorId]);

    const vendor = await db.get(`
      SELECT
        v.vendor_id,
        v.company_name,
        v.rating_avg,
        v.total_ratings,
        v.total_jobs_completed,
        v.vendor_score,
        u.name AS vendor_name
      FROM vendors v
      JOIN users u ON u.user_id = v.user_id
      WHERE v.vendor_id = ?
    `, [vendorId]);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    res.json({ vendor, reviews });
  } catch (err) {
    console.error('Fetch ratings failed:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

module.exports = router;
