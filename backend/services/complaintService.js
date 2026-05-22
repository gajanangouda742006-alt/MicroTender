const db = require('../config/database');
const { runComplaintChecks, updateReputation } = require('./antifraud');
const { estimateCostAI, determinePriority } = require('./costEstimation');
const { analyzeComplaint, detectDuplicates } = require('./aiAnalyzer');
const notifications = require('../routes/notifications');
const { findNearbyVendors } = require('./vendorMatching');

async function notifyAdmins(app, title, message, type = 'info') {
  const admins = await db.all('SELECT user_id FROM users WHERE role = "admin"');
  for (let admin of admins) {
    await notifications.sendNotification(app, admin.user_id, title, message, type);
  }
}

async function submitComplaint(app, userId, data) {
  const { category, description, latitude, longitude, user_lat, user_lon, imageUrl } = data;
  
  if (!category || !description) {
    throw new Error('Category and description are required.');
  }

  const lat = parseFloat(latitude) || null;
  const lon = parseFloat(longitude) || null;

  const fraudCheck = await runComplaintChecks(
    userId, description, lat, lon, imageUrl,
    parseFloat(user_lat) || null, parseFloat(user_lon) || null
  );

  if (!fraudCheck.passed) {
    throw { status: 429, error: 'Complaint blocked by anti-fraud system', reasons: fraudCheck.blocks };
  }

  const aiAnalysis = await analyzeComplaint(description, imageUrl ? `/${imageUrl}` : null);
  const duplicateCheck = await detectDuplicates(lat, lon, aiAnalysis.category, description);

  const result = await db.run(
    'INSERT INTO complaints (user_id, category, description, latitude, longitude, image_url, ai_analysis, department, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, aiAnalysis.category, description, lat, lon,
      imageUrl ? `/${imageUrl}` : null, JSON.stringify(aiAnalysis), aiAnalysis.department, 'under_review']
  );

  const complaint = await db.get('SELECT * FROM complaints WHERE complaint_id = ?', [result.insertId]);
  const complaintId = result.insertId;

  await updateReputation(userId, 'valid_complaint');

  // Create tender immediately with AI-estimated cost and priority
  const priority = aiAnalysis.priority || 'Normal';
  const costEstimation = await estimateCostAI(aiAnalysis.category, description);
  const estimatedCost = aiAnalysis.estimatedCost || costEstimation.estimatedCost;

  const tenderResult = await db.run(
    'INSERT INTO micro_tenders (complaint_id, estimated_cost, priority) VALUES (?, ?, ?)',
    [complaintId, estimatedCost, priority]
  );

  const tender = await db.get('SELECT * FROM micro_tenders WHERE tender_id = ?', [tenderResult.insertId]);

  // Fraud Alert Notification
  if (fraudCheck.warnings && fraudCheck.warnings.length > 0) {
    // Admin #3
    await notifyAdmins(app, 'Potential Fraudulent Complaint', `Complaint #${complaintId} by user ${userId} flagged as suspicious.`, 'danger');
    // Citizen #9
    await notifications.sendNotification(app, userId, 'Authenticity Verification', 'Your complaint is under authenticity verification.', 'warning');
  }

  // High Severity Notification
  if (priority === 'Critical') {
    // Admin #2
    await notifyAdmins(app, 'Critical Severity Issue', `Critical civic issue detected near public area (Complaint #${complaintId}).`, 'danger');
  }

  // Citizen #1
  await notifications.sendNotification(
    app,
    userId,
    'Complaint Submitted',
    `Complaint submitted successfully. Tracking ID: CMP-${complaintId}`,
    'success'
  );

  // Admin #1
  await notifyAdmins(
    app,
    'New Complaint Received',
    `New complaint submitted requiring review. Tracking ID: CMP-${complaintId}`,
    'info'
  );

  // Notify nearby vendors about new tender
  const nearbyVendors = await findNearbyVendors(lat, lon, aiAnalysis.category, 10);
  for (const vendor of nearbyVendors) {
    await notifications.sendNotification(
      app, vendor.user_id, 'New Tender Available',
      'New civic tender available in your service area.', 'info'
    );
  }

  return {
    complaint,
    aiAnalysis,
    duplicates: duplicateCheck,
    fraudWarnings: fraudCheck.warnings,
    tender
  };
}

async function approveComplaint(app, complaintId) {
  const complaint = await db.get('SELECT * FROM complaints WHERE complaint_id = ?', [complaintId]);
  if (!complaint) throw new Error('Complaint not found');
  if (complaint.status !== 'under_review' && complaint.status !== 'pending') {
    throw new Error('Complaint is not in a reviewable state');
  }

  const aiAnalysis = complaint.ai_analysis ? JSON.parse(complaint.ai_analysis) : {};
  const priority = aiAnalysis.priority || determinePriority(complaint.category, complaint.description);
  const estimatedCost = aiAnalysis.estimatedCost || (await estimateCostAI(complaint.category, complaint.description)).estimatedCost;

  await db.run(
    'INSERT INTO micro_tenders (complaint_id, estimated_cost, priority) VALUES (?, ?, ?)',
    [complaint.complaint_id, estimatedCost, priority]
  );

  await db.run("UPDATE complaints SET status = 'tender_created' WHERE complaint_id = ?", [complaint.complaint_id]);

  const tender = await db.get('SELECT * FROM micro_tenders WHERE complaint_id = ?', [complaint.complaint_id]);

  // Citizen #3
  await notifications.sendNotification(
    app, complaint.user_id, 'Complaint Approved',
    'Your complaint has been approved and tender created.', 'success'
  );

  // Vendor #1
  const nearbyVendors = await findNearbyVendors(complaint.latitude, complaint.longitude, complaint.category, 10);
  for (const vendor of nearbyVendors) {
    await notifications.sendNotification(
      app, vendor.user_id, 'New Tender Available',
      'New civic tender available in your service area.', 'info'
    );
  }

  return tender;
}

async function rejectComplaint(app, complaintId, reason = 'Rejected by Admin') {
  const complaint = await db.get('SELECT * FROM complaints WHERE complaint_id = ?', [complaintId]);
  if (!complaint) throw new Error('Complaint not found');
  
  await db.run("UPDATE complaints SET status = 'rejected', admin_notes = ? WHERE complaint_id = ?", [reason, complaintId]);

  // Citizen #4
  await notifications.sendNotification(
    app, complaint.user_id, 'Complaint Rejected',
    `Complaint rejected due to insufficient details. Reason: ${reason}`, 'error'
  );

  return { message: 'Complaint rejected successfully' };
}

module.exports = {
  submitComplaint,
  approveComplaint,
  rejectComplaint
};
