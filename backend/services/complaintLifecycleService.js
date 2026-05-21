const db = require('../config/database');
const notifications = require('../routes/notifications');
const { verifyCompletion } = require('./aiAnalyzer');
const { estimateCostAI, determinePriority } = require('./costEstimation');
const { getRecommendedVendorsForTender } = require('./vendorRecommendationService');
const { refreshVendorMetrics } = require('./vendorReputationService');

async function fetchOne(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows[0];
}

async function fetchAll(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

function emitLifecycleEvent(app, eventName, complaintId, payload = {}) {
  const io = app?.get('io');
  if (!io) return;

  const eventPayload = {
    complaintId,
    ...payload,
    emittedAt: new Date().toISOString(),
  };

  io.emit(eventName, eventPayload);
  io.emit('complaint_updated', eventPayload);
  io.to(`complaint_${complaintId}`).emit(eventName, eventPayload);
  io.to(`complaint_${complaintId}`).emit('complaint_updated', eventPayload);
  if (payload.tenderId) {
    io.to(`tender_${payload.tenderId}`).emit(eventName, eventPayload);
  }
}

async function ensureTenderForComplaint(complaintId) {
  const complaint = await db.get('SELECT * FROM complaints WHERE complaint_id = ?', [complaintId]);
  if (!complaint) {
    const error = new Error('Complaint not found.');
    error.status = 404;
    throw error;
  }

  let tender = await db.get('SELECT * FROM micro_tenders WHERE complaint_id = ?', [complaintId]);
  if (tender) return { complaint, tender };

  const aiAnalysis = complaint.ai_analysis ? JSON.parse(complaint.ai_analysis) : {};
  const estimatedCost = aiAnalysis.estimatedCost || (await estimateCostAI(complaint.category, complaint.description)).estimatedCost;
  const priority = aiAnalysis.priority || determinePriority(complaint.category, complaint.description);

  const result = await db.run(`
    INSERT INTO micro_tenders (complaint_id, estimated_cost, priority, status)
    VALUES (?, ?, ?, 'open')
  `, [complaintId, estimatedCost, priority]);

  await db.run(`
    UPDATE complaints
    SET status = 'tender_created', updated_at = NOW()
    WHERE complaint_id = ?
  `, [complaintId]);

  tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [result.insertId]);
  return { complaint: { ...complaint, status: 'tender_created' }, tender };
}

async function assignTenderToVendor({ app, tenderId, vendorId, adminId, notes = '', mode = 'manual' }) {
  const pool = db.getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const tender = await fetchOne(conn, `
      SELECT mt.*, c.user_id AS citizen_user_id, c.complaint_id, c.category
      FROM micro_tenders mt
      JOIN complaints c ON c.complaint_id = mt.complaint_id
      WHERE mt.tender_id = ?
      FOR UPDATE
    `, [tenderId]);
    if (!tender) {
      const error = new Error('Tender not found.');
      error.status = 404;
      throw error;
    }

    const vendor = await fetchOne(conn, `
      SELECT v.*, u.name AS vendor_name, u.user_id, u.email, u.phone
      FROM vendors v
      JOIN users u ON u.user_id = v.user_id
      WHERE v.vendor_id = ?
      FOR UPDATE
    `, [vendorId]);
    if (!vendor) {
      const error = new Error('Vendor not found.');
      error.status = 404;
      throw error;
    }

    const application = await fetchOne(conn, `
      SELECT *
      FROM applications
      WHERE tender_id = ? AND vendor_id = ?
      FOR UPDATE
    `, [tenderId, vendorId]);

    await conn.execute(`
      UPDATE vendor_assignments
      SET status = 'reassigned', updated_at = NOW()
      WHERE tender_id = ? AND status = 'assigned'
    `, [tenderId]);

    await conn.execute(`
      UPDATE micro_tenders
      SET assigned_vendor_id = ?, status = 'assigned', verification_status = 'assigned'
      WHERE tender_id = ?
    `, [vendorId, tenderId]);

    await conn.execute(`
      UPDATE complaints
      SET status = 'assigned', updated_at = NOW()
      WHERE complaint_id = ?
    `, [tender.complaint_id]);

    await conn.execute(`
      UPDATE applications
      SET status = CASE
        WHEN vendor_id = ? THEN 'accepted'
        ELSE 'rejected'
      END
      WHERE tender_id = ?
    `, [vendorId, tenderId]);

    await conn.execute(`
      INSERT INTO vendor_assignments (
        tender_id,
        complaint_id,
        vendor_id,
        assigned_by,
        assignment_mode,
        ai_score,
        bid_amount,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned')
    `, [
      tenderId,
      tender.complaint_id,
      vendorId,
      adminId,
      mode,
      application?.ai_score || vendor.vendor_score || 0,
      application?.bid_amount || tender.estimated_cost || 0,
      notes || null,
    ]);

    const otherVendorUsers = await fetchAll(conn, `
      SELECT v.user_id
      FROM applications a
      JOIN vendors v ON v.vendor_id = a.vendor_id
      WHERE a.tender_id = ? AND a.vendor_id != ?
    `, [tenderId, vendorId]);

    await conn.commit();

    await notifications.sendNotification(app, vendor.user_id, {
      title: 'Work Assignment Confirmed',
      message: `You have been assigned to complaint #${tender.complaint_id}. Open your assigned work queue to begin.`,
      type: 'success',
      action_url: '/vendor/assigned-work',
      metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, vendor_id: vendor.vendor_id },
    });

    await notifications.sendNotification(app, tender.citizen_user_id, {
      title: 'Vendor Assigned',
      message: `${vendor.company_name || vendor.vendor_name} has been assigned to your complaint.`,
      type: 'success',
      action_url: `/citizen/complaint/${tender.complaint_id}`,
      metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, vendor_id: vendor.vendor_id },
    });

    for (const otherVendor of otherVendorUsers) {
      await notifications.sendNotification(app, otherVendor.user_id, {
        title: 'Bid Outcome Update',
        message: 'Another vendor has been selected for this complaint. Your application has been closed.',
        type: 'info',
        action_url: `/vendor/complaints/${tender.complaint_id}`,
        metadata: { complaint_id: tender.complaint_id, tender_id: tenderId },
      });
    }

    emitLifecycleEvent(app, 'vendor_assignment_updated', tender.complaint_id, {
      tenderId,
      vendorId,
      assignmentMode: mode,
    });

    return {
      tenderId,
      complaintId: tender.complaint_id,
      vendor: {
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_name,
        company_name: vendor.company_name,
      },
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function submitCompletionProof({ app, tenderId, vendorUserId, files, completionNote }) {
  if (!files || files.length === 0) {
    const error = new Error('At least one completion image is required.');
    error.status = 400;
    throw error;
  }

  const vendor = await db.get(`
    SELECT v.vendor_id, v.user_id, v.company_name, u.name AS vendor_name
    FROM vendors v
    JOIN users u ON u.user_id = v.user_id
    WHERE v.user_id = ?
  `, [vendorUserId]);

  if (!vendor) {
    const error = new Error('Vendor profile not found.');
    error.status = 404;
    throw error;
  }

  const tender = await db.get(`
    SELECT mt.*, c.complaint_id, c.user_id AS citizen_user_id, c.image_url, c.description, c.category
    FROM micro_tenders mt
    JOIN complaints c ON c.complaint_id = mt.complaint_id
    WHERE mt.tender_id = ?
  `, [tenderId]);

  if (!tender || tender.assigned_vendor_id !== vendor.vendor_id) {
    const error = new Error('You are not assigned to this complaint.');
    error.status = 403;
    throw error;
  }

  const imageUrls = files.map((file) => `/uploads/${file.filename}`);
  const aiVerification = await verifyCompletion(tender.image_url, imageUrls[0], completionNote);

  const latestProgress = await db.get(`
    SELECT progress_percentage
    FROM work_updates
    WHERE tender_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [tenderId]);

  const proofResult = await db.run(`
    INSERT INTO completion_proofs (
      tender_id,
      complaint_id,
      vendor_id,
      submitted_by,
      completion_note,
      cover_image_url,
      image_urls,
      progress_snapshot,
      ai_verdict,
      ai_summary,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    tenderId,
    tender.complaint_id,
    vendor.vendor_id,
    vendorUserId,
    completionNote || null,
    imageUrls[0],
    JSON.stringify(imageUrls),
    latestProgress?.progress_percentage || 100,
    aiVerification.fraudDetected ? 'suspicious' : (aiVerification.isResolved ? 'ready' : 'review'),
    aiVerification.reasoning || 'Pending admin inspection',
  ]);

  await db.run(`
    UPDATE micro_tenders
    SET
      completion_image = ?,
      completion_note = ?,
      status = 'completed',
      verification_status = 'pending',
      completed_at = NOW()
    WHERE tender_id = ?
  `, [imageUrls[0], completionNote || null, tenderId]);

  await db.run(`
    INSERT INTO work_updates (
      tender_id,
      vendor_id,
      description,
      image_url,
      progress_percentage,
      verification_status,
      verification_reasoning,
      update_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completion')
  `, [
    tenderId,
    vendor.vendor_id,
    completionNote || 'Vendor marked the job as completed and uploaded final proof.',
    imageUrls[0],
    100,
    aiVerification.fraudDetected ? 'suspicious' : 'pending',
    aiVerification.reasoning || 'Pending admin verification.',
  ]);

  const admins = await db.all(`SELECT user_id FROM users WHERE role = 'admin'`);
  for (const admin of admins) {
    await notifications.sendNotification(app, admin.user_id, {
      title: 'Vendor submitted completion proof',
      message: `Complaint #${tender.complaint_id} has new completion proof waiting for review.`,
      type: 'info',
      action_url: `/admin/complaints/${tender.complaint_id}`,
      metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proofResult.insertId },
    });
  }

  await notifications.sendNotification(app, tender.citizen_user_id, {
    title: 'Completion proof uploaded',
    message: `${vendor.company_name || vendor.vendor_name} submitted final proof. Admin review is now in progress.`,
    type: 'info',
    action_url: `/citizen/complaint/${tender.complaint_id}`,
    metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proofResult.insertId },
  });

  emitLifecycleEvent(app, 'completion_submitted', tender.complaint_id, {
    tenderId,
    proofId: proofResult.insertId,
    vendorId: vendor.vendor_id,
  });

  return {
    proof_id: proofResult.insertId,
    image_urls: imageUrls,
    aiVerification,
  };
}

async function reviewCompletion({ app, tenderId, action, adminId, notes = '' }) {
  const tender = await db.get(`
    SELECT mt.*, c.complaint_id, c.user_id AS citizen_user_id
    FROM micro_tenders mt
    JOIN complaints c ON c.complaint_id = mt.complaint_id
    WHERE mt.tender_id = ?
  `, [tenderId]);

  if (!tender) {
    const error = new Error('Tender not found.');
    error.status = 404;
    throw error;
  }

  const proof = await db.get(`
    SELECT *
    FROM completion_proofs
    WHERE tender_id = ?
    ORDER BY submitted_at DESC
    LIMIT 1
  `, [tenderId]);

  if (!proof) {
    const error = new Error('No completion proof submitted yet.');
    error.status = 404;
    throw error;
  }

  const vendorUser = await db.get('SELECT user_id FROM vendors WHERE vendor_id = ?', [tender.assigned_vendor_id]);
  const normalizedAction = action === 'request_rework' ? 'rework_requested' : action;

  if (!['approve', 'reject', 'rework_requested'].includes(normalizedAction)) {
    const error = new Error('Invalid verification action.');
    error.status = 400;
    throw error;
  }

  if (normalizedAction === 'approve') {
    await db.run(`
      UPDATE completion_proofs
      SET status = 'approved', review_notes = ?, reviewed_at = NOW()
      WHERE proof_id = ?
    `, [notes || null, proof.proof_id]);

    await db.run(`
      UPDATE micro_tenders
      SET status = 'closed', verification_status = 'verified'
      WHERE tender_id = ?
    `, [tenderId]);

    await db.run(`
      UPDATE complaints
      SET status = 'completed', updated_at = NOW()
      WHERE complaint_id = ?
    `, [tender.complaint_id]);

    await db.run(`
      UPDATE vendor_assignments
      SET status = 'completed', updated_at = NOW()
      WHERE tender_id = ? AND vendor_id = ?
    `, [tenderId, tender.assigned_vendor_id]);

    if (tender.assigned_vendor_id) {
      await refreshVendorMetrics(tender.assigned_vendor_id);
    }

    await notifications.sendNotification(app, tender.citizen_user_id, {
      title: 'Completion approved',
      message: 'Your complaint has been fully verified. You can now review the completed work and rate the vendor.',
      type: 'success',
      action_url: '/citizen/completed-complaints',
      metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proof.proof_id },
    });

    if (vendorUser) {
      await notifications.sendNotification(app, vendorUser.user_id, {
        title: 'Completion approved',
        message: 'Your final proof has been approved by the admin.',
        type: 'success',
        action_url: '/vendor/reviews',
        metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proof.proof_id },
      });
    }
  } else {
    const proofStatus = normalizedAction === 'reject' ? 'rejected' : 'rework_requested';

    await db.run(`
      UPDATE completion_proofs
      SET status = ?, review_notes = ?, reviewed_at = NOW()
      WHERE proof_id = ?
    `, [proofStatus, notes || null, proof.proof_id]);

    await db.run(`
      UPDATE micro_tenders
      SET status = 'in_progress', verification_status = ?
      WHERE tender_id = ?
    `, [proofStatus, tenderId]);

    await db.run(`
      UPDATE complaints
      SET status = 'in_progress', updated_at = NOW()
      WHERE complaint_id = ?
    `, [tender.complaint_id]);

    await db.run(`
      UPDATE vendor_assignments
      SET status = ?, updated_at = NOW()
      WHERE tender_id = ? AND vendor_id = ?
    `, [proofStatus, tenderId, tender.assigned_vendor_id]);

    if (vendorUser) {
      await notifications.sendNotification(app, vendorUser.user_id, {
        title: normalizedAction === 'reject' ? 'Completion rejected' : 'Rework requested',
        message: notes || (normalizedAction === 'reject'
          ? 'Admin rejected the completion proof. Please upload new proof.'
          : 'Admin requested rework before approval.'),
        type: 'warning',
        action_url: `/vendor/complaints/${tender.complaint_id}`,
        metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proof.proof_id },
      });
    }

    await notifications.sendNotification(app, tender.citizen_user_id, {
      title: normalizedAction === 'reject' ? 'Completion rejected' : 'Rework requested',
      message: 'The vendor has been asked to continue work before your complaint can be closed.',
      type: 'info',
      action_url: `/citizen/complaint/${tender.complaint_id}`,
      metadata: { complaint_id: tender.complaint_id, tender_id: tenderId, proof_id: proof.proof_id },
    });
  }

  emitLifecycleEvent(app, 'completion_reviewed', tender.complaint_id, {
    tenderId,
    action: normalizedAction,
    reviewedBy: adminId,
  });

  return { success: true };
}

async function getComplaintLifecycleDetails(complaintId) {
  const complaint = await db.get(`
    SELECT
      c.*,
      u.name AS citizen_name,
      u.phone AS citizen_phone,
      u.email AS citizen_email
    FROM complaints c
    JOIN users u ON u.user_id = c.user_id
    WHERE c.complaint_id = ?
  `, [complaintId]);

  if (!complaint) return null;

  const tender = await db.get(`
    SELECT
      mt.*,
      v.company_name AS vendor_company,
      vu.name AS vendor_name,
      vu.phone AS vendor_phone,
      vu.email AS vendor_email
    FROM micro_tenders mt
    LEFT JOIN vendors v ON v.vendor_id = mt.assigned_vendor_id
    LEFT JOIN users vu ON vu.user_id = v.user_id
    WHERE mt.complaint_id = ?
  `, [complaintId]);

  const [applications, workUpdates, completionProofs, rating] = await Promise.all([
    tender ? db.all(`
      SELECT
        a.*,
        v.user_id,
        v.company_name,
        v.rating_avg,
        v.total_jobs_completed,
        v.experience_years,
        v.vendor_score,
        u.name AS vendor_name,
        u.phone AS vendor_phone
      FROM applications a
      JOIN vendors v ON v.vendor_id = a.vendor_id
      JOIN users u ON u.user_id = v.user_id
      WHERE a.tender_id = ?
      ORDER BY a.status = 'accepted' DESC, a.ai_score DESC, a.bid_amount ASC
    `, [tender.tender_id]) : [],
    tender ? db.all(`
      SELECT
        wu.*,
        v.company_name,
        u.name AS vendor_name
      FROM work_updates wu
      JOIN vendors v ON v.vendor_id = wu.vendor_id
      JOIN users u ON u.user_id = v.user_id
      WHERE wu.tender_id = ?
      ORDER BY wu.created_at DESC
    `, [tender.tender_id]) : [],
    tender ? db.all(`
      SELECT
        cp.*,
        v.company_name,
        u.name AS vendor_name
      FROM completion_proofs cp
      JOIN vendors v ON v.vendor_id = cp.vendor_id
      JOIN users u ON u.user_id = v.user_id
      WHERE cp.tender_id = ?
      ORDER BY cp.submitted_at DESC
    `, [tender.tender_id]) : [],
    db.get(`
      SELECT
        r.rating_id,
        r.score,
        r.feedback,
        r.created_at,
        u.name AS citizen_name
      FROM ratings r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.complaint_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `, [complaintId]),
  ]);

  const assignedVendor = tender?.assigned_vendor_id
    ? await db.get(`
      SELECT
        v.*,
        u.name AS vendor_name,
        u.email AS vendor_email,
        u.phone AS vendor_phone,
        u.reputation_score
      FROM vendors v
      JOIN users u ON u.user_id = v.user_id
      WHERE v.vendor_id = ?
    `, [tender.assigned_vendor_id])
    : null;

  const recommendedVendors = tender ? await getRecommendedVendorsForTender(tender.tender_id, 5) : [];
  const latestWorkUpdate = workUpdates[0] || null;
  const latestCompletionProof = completionProofs[0]
    ? {
        ...completionProofs[0],
        image_urls: completionProofs[0].image_urls ? JSON.parse(completionProofs[0].image_urls) : [],
      }
    : null;

  return {
    complaint,
    tender,
    assignedVendor,
    applications,
    workUpdates,
    completionProofs: completionProofs.map((proof) => ({
      ...proof,
      image_urls: proof.image_urls ? JSON.parse(proof.image_urls) : [],
    })),
    latestCompletionProof,
    latestWorkUpdate,
    recommendedVendors,
    rating,
  };
}

module.exports = {
  emitLifecycleEvent,
  ensureTenderForComplaint,
  assignTenderToVendor,
  submitCompletionProof,
  reviewCompletion,
  getComplaintLifecycleDetails,
};
