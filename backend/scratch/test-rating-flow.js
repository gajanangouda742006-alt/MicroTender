const db = require('../config/database');

async function run() {
  console.log('🏁 Starting Vendor Rating System Integration Test...');
  await db.initDatabase();

  // 1. Set up test citizen and vendor
  console.log('👤 Setting up test users...');
  // Check if test citizen exists or create
  let citizen = await db.get('SELECT * FROM users WHERE email = ?', ['test_citizen@gmail.com']);
  if (!citizen) {
    const res = await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Test Citizen', 'test_citizen@gmail.com', 'password123', 'citizen']
    );
    citizen = await db.get('SELECT * FROM users WHERE user_id = ?', [res.insertId]);
  }

  let vendorUser = await db.get('SELECT * FROM users WHERE email = ?', ['test_vendor@gmail.com']);
  if (!vendorUser) {
    const res = await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Test Vendor', 'test_vendor@gmail.com', 'password123', 'vendor']
    );
    vendorUser = await db.get('SELECT * FROM users WHERE user_id = ?', [res.insertId]);
  }

  let vendor = await db.get('SELECT * FROM vendors WHERE user_id = ?', [vendorUser.user_id]);
  if (!vendor) {
    const res = await db.run(
      'INSERT INTO vendors (user_id, company_name, category, skills) VALUES (?, ?, ?, ?)',
      [vendorUser.user_id, 'Test Vendor Co', 'road_damage', 'Paving, Patching']
    );
    vendor = await db.get('SELECT * FROM vendors WHERE vendor_id = ?', [res.insertId]);
  }

  console.log(`✅ Citizen: ${citizen.name} (ID: ${citizen.user_id})`);
  console.log(`✅ Vendor: ${vendor.company_name} (ID: ${vendor.vendor_id})`);

  // 2. Create test complaint
  console.log('📝 Creating test complaint...');
  const compRes = await db.run(
    'INSERT INTO complaints (user_id, category, description, status) VALUES (?, ?, ?, ?)',
    [citizen.user_id, 'road_damage', 'Huge pothole on main street', 'completed']
  );
  const complaintId = compRes.insertId;
  console.log(`✅ Complaint created with ID: ${complaintId} and marked as completed`);

  // 3. Create micro_tender and assign to vendor
  console.log('💼 Assigning micro-tender to vendor...');
  const tenderRes = await db.run(
    'INSERT INTO micro_tenders (complaint_id, estimated_cost, status, assigned_vendor_id) VALUES (?, ?, ?, ?)',
    [complaintId, 5000, 'completed', vendor.vendor_id]
  );
  const tenderId = tenderRes.insertId;
  console.log(`✅ Micro-tender created with ID: ${tenderId} assigned to vendor ID: ${vendor.vendor_id}`);

  // 4. Record initial vendor statistics
  const vendorBefore = await db.get('SELECT rating_avg, total_ratings FROM vendors WHERE vendor_id = ?', [vendor.vendor_id]);
  console.log(`📊 Initial stats: Avg Rating = ${vendorBefore.rating_avg}, Total Ratings = ${vendorBefore.total_ratings}`);

  // 5. Submit rating 1 (Citizen rates vendor 5 stars)
  console.log('⭐ Submitting rating 1 (5 stars)...');
  await db.run(
    'INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback) VALUES (?, ?, ?, ?, ?)',
    [vendor.vendor_id, complaintId, citizen.user_id, 5, 'Excellent service, super fast repair!']
  );
  console.log('✅ Rating 1 inserted successfully');

  // 6. Trigger stats update query
  console.log('🔄 Recalculating vendor statistics in database...');
  await db.run(`
    UPDATE vendors
    SET
      rating_avg = (
        SELECT AVG(score)
        FROM ratings
        WHERE vendor_id = ?
      ),
      total_ratings = (
        SELECT COUNT(*)
        FROM ratings
        WHERE vendor_id = ?
      )
    WHERE vendor_id = ?;
  `, [vendor.vendor_id, vendor.vendor_id, vendor.vendor_id]);

  const vendorAfter1 = await db.get('SELECT rating_avg, total_ratings FROM vendors WHERE vendor_id = ?', [vendor.vendor_id]);
  console.log(`📊 Stats after rating 1: Avg Rating = ${vendorAfter1.rating_avg}, Total Ratings = ${vendorAfter1.total_ratings}`);

  // Assert rating_avg === 5.0 and total_ratings === 1
  if (vendorAfter1.rating_avg === 5.0 && vendorAfter1.total_ratings === 1) {
    console.log('🎉 ASSERTION SUCCESS: Average rating is 5.0 and total ratings is 1!');
  } else {
    throw new Error(`Assertion failed: Expected 5.0 average and 1 total, got ${vendorAfter1.rating_avg} and ${vendorAfter1.total_ratings}`);
  }

  // 7. Prevent Duplicate Ratings: Try to rate again for the same complaint and citizen
  console.log('🚫 Testing prevention of duplicate ratings (should fail)...');
  try {
    await db.run(
      'INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback) VALUES (?, ?, ?, ?, ?)',
      [vendor.vendor_id, complaintId, citizen.user_id, 1, 'Changed my mind, bad work.']
    );
    throw new Error('FAILED: Double rating was permitted! Unique constraint uq_complaint_user is not working!');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry')) {
      console.log('🎉 ASSERTION SUCCESS: Duplicate rating blocked by MySQL constraint!');
    } else {
      console.error('Unexpected error when testing duplicate insertion:', err);
      throw err;
    }
  }

  // 8. Clean up
  console.log('🧹 Cleaning up test data...');
  await db.run('DELETE FROM ratings WHERE complaint_id = ?', [complaintId]);
  await db.run('DELETE FROM micro_tenders WHERE tender_id = ?', [tenderId]);
  await db.run('DELETE FROM complaints WHERE complaint_id = ?', [complaintId]);
  await db.run('DELETE FROM vendors WHERE vendor_id = ?', [vendor.vendor_id]);
  await db.run('DELETE FROM users WHERE user_id IN (?, ?)', [citizen.user_id, vendorUser.user_id]);
  console.log('✅ Clean up complete!');

  console.log('\n🌟 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Integration Test Failed:', err);
  process.exit(1);
});
