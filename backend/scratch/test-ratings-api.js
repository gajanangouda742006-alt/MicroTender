const http = require('http');

const citizenCredentials = JSON.stringify({
  email: 'rajesh@gmail.com',
  password: 'password123'
});

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log('🏁 Starting Ratings API Route Integration Test...');

  // 1. Log in as citizen 'rajesh@gmail.com' to get a JWT token
  console.log('🔑 Logging in as citizen...');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(citizenCredentials)
    }
  }, citizenCredentials);

  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }

  const token = loginRes.body.token;
  console.log('✅ Logged in successfully. JWT Token acquired.');

  // 2. We need a completed complaint for this citizen.
  // Rajesh Kumar is user_id 2 in seed.js.
  // In seed.js:
  // Complaint 1 (pothole) belongs to user_id 2 and status is 'completed'.
  // Tender 1 has complaint_id 1, vendor_id 1 (Vikram Construction Co.).
  // In seed.js, a rating is already created for complaint 1 by user 2.
  // Therefore, submitting a new rating for complaint 1 should return 409 Conflict.
  console.log('⭐ Attempting to rate complaint 1 (should fail with 409 duplicate entry since it is seeded)...');
  const duplicateRatingData = JSON.stringify({
    complaint_id: 1,
    score: 4,
    feedback: 'Nice try'
  });

  const dupRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ratings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(duplicateRatingData)
    }
  }, duplicateRatingData);

  console.log(`📡 Route response: Status = ${dupRes.status}, Body =`, dupRes.body);
  if (dupRes.status === 409) {
    console.log('🎉 ASSERTION SUCCESS: Duplicate rating correctly blocked with 409 Conflict!');
  } else {
    throw new Error(`Assertion failed: Expected 409 Conflict for duplicate rating, got ${dupRes.status}`);
  }

  // 3. Let's create a new complaint for Rajesh, mark it completed, assign vendor 1, and submit a rating.
  // We can do this directly in the DB using the db config inside our scratch script.
  console.log('📝 Creating a new completed complaint directly in DB to test successful rating...');
  const db = require('../config/database');
  await db.initDatabase();

  const newComp = await db.run(
    'INSERT INTO complaints (user_id, category, description, status) VALUES (?, ?, ?, ?)',
    [2, 'streetlight', 'Streetlight flickering on Main St', 'completed']
  );
  const complaintId = newComp.insertId;

  // Create micro_tender and assign to vendor 1
  const newTender = await db.run(
    'INSERT INTO micro_tenders (complaint_id, estimated_cost, status, assigned_vendor_id) VALUES (?, ?, ?, ?)',
    [complaintId, 3000, 'completed', 1]
  );
  const tenderId = newTender.insertId;

  console.log(`✅ Temporary Completed Complaint created (ID: ${complaintId}) and assigned to Vendor 1`);

  // 4. Submit rating for the new complaint
  console.log('⭐ Submitting 5-star rating for the new complaint...');
  const ratingData = JSON.stringify({
    complaint_id: complaintId,
    score: 5,
    feedback: 'Flickering resolved perfectly! Excellent work by Vikram Construction.'
  });

  const ratingRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ratings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(ratingData)
    }
  }, ratingData);

  console.log(`📡 Route response: Status = ${ratingRes.status}, Body =`, ratingRes.body);
  if (ratingRes.status === 201) {
    console.log('🎉 ASSERTION SUCCESS: Rating submitted successfully!');
  } else {
    throw new Error(`Assertion failed: Expected 201 Created, got ${ratingRes.status}`);
  }

  // 5. Test GET /api/ratings/vendor/1
  console.log('🔍 Fetching reviews history for Vendor 1...');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ratings/vendor/1',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log(`📡 Route response: Status = ${getRes.status}`);
  console.log(`👤 Vendor: ${getRes.body.vendor.company_name}`);
  console.log(`📊 Rating Avg: ${getRes.body.vendor.rating_avg}`);
  console.log(`📊 Total Ratings: ${getRes.body.vendor.total_ratings}`);
  console.log(`📝 Reviews Count: ${getRes.body.reviews.length}`);

  // Assert that our feedback is included in reviews
  const reviewFound = getRes.body.reviews.find(r => r.feedback?.includes('Flickering resolved perfectly'));
  if (reviewFound) {
    console.log('🎉 ASSERTION SUCCESS: Feedback found in reviews history!');
  } else {
    throw new Error('Assertion failed: Feedback not found in reviews list');
  }

  // 6. Clean up the temp complaint, tender, and rating
  console.log('🧹 Cleaning up temporary test data...');
  await db.run('DELETE FROM ratings WHERE complaint_id = ?', [complaintId]);
  await db.run('DELETE FROM micro_tenders WHERE tender_id = ?', [tenderId]);
  await db.run('DELETE FROM complaints WHERE complaint_id = ?', [complaintId]);
  
  // Recalculate Vendor 1 average to restore original state
  await db.run(`
    UPDATE vendors
    SET
      rating_avg = (
        SELECT AVG(score)
        FROM ratings
        WHERE vendor_id = 1
      ),
      total_ratings = (
        SELECT COUNT(*)
        FROM ratings
        WHERE vendor_id = 1
      )
    WHERE vendor_id = 1;
  `);
  console.log('✅ Clean up complete!');

  console.log('\n🌟 ALL ROUTE ENDPOINT TESTS PASSED SUCCESSFULLY! 🌟');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Endpoint Test Failed:', err);
  process.exit(1);
});
