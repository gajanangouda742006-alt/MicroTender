const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/database');

const PORT = 5000;
const HOST = '127.0.0.1';
const backendDir = path.join(__dirname, '..');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, reqPath, { token, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: reqPath,
        method,
        headers: {
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (_) {}
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) return res;
    } catch (_) {}
    await sleep(500);
  }
  throw new Error('Backend health endpoint did not become ready in time.');
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

function record(results, name, pass, detail) {
  results.push({ name, pass, detail });
  const icon = pass ? '[PASS]' : '[FAIL]';
  console.log(`${icon} ${name}: ${detail}`);
}

async function main() {
  const results = [];
  const createdComplaintIds = [];
  const serverLogs = { out: [], err: [] };
  let server;
  let originalVendorLocation = null;

  await db.initDatabase();
  originalVendorLocation = await db.get(
    'SELECT vendor_id, latitude, longitude FROM vendors WHERE user_id = ?',
    [6]
  );
  await db.run('UPDATE vendors SET latitude = ?, longitude = ? WHERE vendor_id = ?', [
    19.076,
    72.8777,
    originalVendorLocation.vendor_id,
  ]);

  try {
    server = spawn(process.execPath, ['server.js'], {
      cwd: backendDir,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    server.stdout.on('data', (chunk) => serverLogs.out.push(chunk.toString()));
    server.stderr.on('data', (chunk) => serverLogs.err.push(chunk.toString()));

    const health = await waitForHealth();
    record(
      results,
      'Backend health',
      health.body.status === 'ok' && health.body.db === 'MySQL',
      JSON.stringify(health.body)
    );

    const citizenAuth = await login('rajesh@gmail.com', 'password123');
    const vendorAuth = await login('vikram@vendor.com', 'password123');
    const adminAuth = await login('admin@microtender.gov', 'password123');
    record(results, 'Seeded logins', true, 'Citizen, vendor, and admin logins succeeded.');

    const completedComplaints = await request('GET', '/api/complaints/completed', {
      token: citizenAuth.token,
    });
    record(
      results,
      'Citizen completed complaints',
      completedComplaints.status === 200 && Array.isArray(completedComplaints.body.complaints),
      `status=${completedComplaints.status}, count=${completedComplaints.body.complaints?.length ?? 'n/a'}`
    );

    const unique = Date.now();
    const createComplaint = await request('POST', '/api/complaints', {
      token: citizenAuth.token,
      body: {
        category: 'pothole',
        description: `Runtime smoke test complaint ${unique}`,
        latitude: 19.091 + Math.random() * 0.001,
        longitude: 72.901 + Math.random() * 0.001,
      },
    });

    const createdComplaint = createComplaint.body?.complaint;
    const createdTender = createComplaint.body?.tender;
    createdComplaintIds.push(createdComplaint.complaint_id);
    record(
      results,
      'Citizen complaint submission',
      createComplaint.status === 201,
      `status=${createComplaint.status}, complaintStatus=${createdComplaint?.status}, tenderStatus=${createdTender?.status}`
    );

    const vendorNearbyBefore = await request('GET', '/api/vendors/nearby-tenders?radius=20', {
      token: vendorAuth.token,
    });
    const nearbyBefore = vendorNearbyBefore.body?.tenders || [];
    const visibleBeforeApproval = nearbyBefore.some((t) => t.tender_id === createdTender.tender_id);
    record(
      results,
      'Pre-approval vendor visibility blocked',
      !visibleBeforeApproval,
      `visibleBeforeApproval=${visibleBeforeApproval}`
    );

    const approveComplaint = await request(
      'POST',
      `/api/admin/complaint/${createdComplaint.complaint_id}/approve`,
      {
        token: adminAuth.token,
        body: {},
      }
    );
    record(
      results,
      'Admin complaint approval lifecycle',
      approveComplaint.status === 200,
      `status=${approveComplaint.status}`
    );

    const vendorNearbyAfter = await request('GET', '/api/vendors/nearby-tenders?radius=20', {
      token: vendorAuth.token,
    });
    const nearbyAfter = vendorNearbyAfter.body?.tenders || [];
    const visibleAfterApproval = nearbyAfter.some((t) => t.tender_id === createdTender.tender_id);
    record(
      results,
      'Post-approval vendor visibility',
      vendorNearbyAfter.status === 200 && visibleAfterApproval,
      `status=${vendorNearbyAfter.status}, visibleAfterApproval=${visibleAfterApproval}, count=${nearbyAfter.length}`
    );

    const applyRes = await request('POST', `/api/vendors/apply/${createdTender.tender_id}`, {
      token: vendorAuth.token,
      body: {
        bid_amount: Math.round(createdTender.estimated_cost * 0.9),
        estimated_days: 3,
        proposal: `Runtime smoke test bid ${unique}`,
      },
    });
    record(
      results,
      'Vendor bid submission',
      applyRes.status === 201,
      `status=${applyRes.status}, body=${JSON.stringify(applyRes.body)}`
    );

    const assignRes = await request('POST', '/api/admin/assign-vendor', {
      token: adminAuth.token,
      body: {
        tender_id: createdTender.tender_id,
        vendor_id: 1,
        notes: 'Runtime smoke test assignment',
        mode: 'manual',
      },
    });
    record(
      results,
      'Admin vendor assignment',
      assignRes.status === 200,
      `status=${assignRes.status}, body=${JSON.stringify(assignRes.body)}`
    );

    const myJobs = await request('GET', '/api/vendors/my-jobs', { token: vendorAuth.token });
    const createdJob = (myJobs.body?.jobs || []).find((job) => job.tender_id === createdTender.tender_id);
    record(
      results,
      'Vendor assigned jobs visible',
      myJobs.status === 200 && !!createdJob,
      `status=${myJobs.status}, found=${!!createdJob}`
    );

    const startWork = await request('PATCH', `/api/tenders/${createdTender.tender_id}/status`, {
      token: vendorAuth.token,
      body: { status: 'in_progress' },
    });
    record(
      results,
      'Vendor start work transition',
      startWork.status === 200,
      `status=${startWork.status}`
    );

    const workUpdate = await request('POST', '/api/work-updates', {
      token: vendorAuth.token,
      body: {
        tender_id: createdTender.tender_id,
        description: `Runtime progress update ${unique}`,
        progress_percentage: 50,
      },
    });
    record(
      results,
      'Vendor work update submission',
      workUpdate.status === 201,
      `status=${workUpdate.status}`
    );

    const verifications = await request('GET', '/api/admin/verifications', {
      token: adminAuth.token,
    });
    const verificationFound = (verifications.body?.verifications || []).some(
      (v) => v.tender_id === createdTender.tender_id
    );
    record(
      results,
      'Admin verification feed',
      verifications.status === 200 && verificationFound,
      `status=${verifications.status}, found=${verificationFound}`
    );

    const complaintDetail = await request('GET', `/api/complaints/${createdComplaint.complaint_id}`, {
      token: citizenAuth.token,
    });
    const citizenSawUpdate = (complaintDetail.body?.workUpdates || []).some(
      (update) => update.tender_id === createdTender.tender_id
    );
    record(
      results,
      'Citizen complaint detail updates',
      complaintDetail.status === 200 && citizenSawUpdate,
      `status=${complaintDetail.status}, updates=${complaintDetail.body?.workUpdates?.length ?? 'n/a'}`
    );

    const notificationsReadAll = await request('PATCH', '/api/notifications/read-all', {
      token: citizenAuth.token,
      body: {},
    });
    record(
      results,
      'Notifications read-all',
      notificationsReadAll.status === 200,
      `status=${notificationsReadAll.status}`
    );

    console.log('\nSummary:');
    const passed = results.filter((r) => r.pass).length;
    console.log(`${passed}/${results.length} checks passed.`);

    const failures = results.filter((r) => !r.pass);
    if (failures.length) {
      console.log('Failures:');
      for (const failure of failures) {
        console.log(`- ${failure.name}: ${failure.detail}`);
      }
    }
  } finally {
    try {
      for (const complaintId of createdComplaintIds) {
        await db.run('DELETE FROM complaints WHERE complaint_id = ?', [complaintId]);
      }
      if (originalVendorLocation) {
        await db.run('UPDATE vendors SET latitude = ?, longitude = ? WHERE vendor_id = ?', [
          originalVendorLocation.latitude,
          originalVendorLocation.longitude,
          originalVendorLocation.vendor_id,
        ]);
      }
    } catch (cleanupErr) {
      console.error('Cleanup warning:', cleanupErr.message);
    }

    if (server && !server.killed) {
      server.kill('SIGTERM');
      await sleep(1500);
      if (!server.killed) server.kill('SIGKILL');
    }

    if (serverLogs.err.length) {
      console.log('\nBackend stderr:');
      console.log(serverLogs.err.join(''));
    }

    const pool = db.getPool();
    if (pool) {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error('Harness failed:', err);
  process.exitCode = 1;
});
