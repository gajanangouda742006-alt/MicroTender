/**
 * Database Seeder - Populates demo data for testing
 */
const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function seed() {
  await db.initDatabase();
  console.log('🌱 Seeding database...\n');

  // Clear existing data
  db.exec(`
    DELETE FROM fraud_logs;
    DELETE FROM ratings;
    DELETE FROM applications;
    DELETE FROM micro_tenders;
    DELETE FROM complaints;
    DELETE FROM vendors;
    DELETE FROM users;
  `);

  // --- USERS ---
  const password = await bcrypt.hash('password123', 12);

  const users = [
    { name: 'Admin User', email: 'admin@microtender.gov', phone: '9999900000', password, role: 'admin', govt_id_type: null, govt_id_number: null },
    { name: 'Rajesh Kumar', email: 'rajesh@gmail.com', phone: '9876543210', password, role: 'citizen', govt_id_type: 'aadhaar', govt_id_number: '123456789012' },
    { name: 'Priya Sharma', email: 'priya@gmail.com', phone: '9876543211', password, role: 'citizen', govt_id_type: 'pan', govt_id_number: 'ABCDE1234F' },
    { name: 'Amit Singh', email: 'amit@gmail.com', phone: '9876543212', password, role: 'citizen', govt_id_type: 'aadhaar', govt_id_number: '234567890123' },
    { name: 'Sneha Patel', email: 'sneha@gmail.com', phone: '9876543213', password, role: 'citizen', govt_id_type: 'pan', govt_id_number: 'FGHIJ5678K' },
    { name: 'Vikram Construction', email: 'vikram@vendor.com', phone: '9888800001', password, role: 'vendor', govt_id_type: 'pan', govt_id_number: 'VKCON1234A' },
    { name: 'Suresh Electricals', email: 'suresh@vendor.com', phone: '9888800002', password, role: 'vendor', govt_id_type: 'pan', govt_id_number: 'SUREL5678B' },
    { name: 'Mumbai Plumbers', email: 'plumber@vendor.com', phone: '9888800003', password, role: 'vendor', govt_id_type: 'aadhaar', govt_id_number: '345678901234' },
    { name: 'Green Clean Services', email: 'green@vendor.com', phone: '9888800004', password, role: 'vendor', govt_id_type: 'pan', govt_id_number: 'GRNCL9012C' },
    { name: 'Road Masters Pvt Ltd', email: 'road@vendor.com', phone: '9888800005', password, role: 'vendor', govt_id_type: 'pan', govt_id_number: 'RDMST3456D' },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, phone, password, role, govt_id_type, govt_id_number) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const u of users) {
    insertUser.run(u.name, u.email, u.phone, u.password, u.role, u.govt_id_type, u.govt_id_number);
  }
  console.log(`✅ Created ${users.length} users`);

  // --- VENDORS ---
  const vendorProfiles = [
    { userId: 6, company: 'Vikram Construction Co.', category: 'pothole', skills: '["pothole","road_damage","drainage"]', lat: 19.076, lon: 72.8777, address: '123 MG Road, Mumbai', exp: 8, rating: 4.5, jobs: 45 },
    { userId: 7, company: 'Suresh Electrical Works', category: 'streetlight', skills: '["streetlight","electrical"]', lat: 19.082, lon: 72.882, address: '45 Linking Road, Mumbai', exp: 12, rating: 4.2, jobs: 62 },
    { userId: 8, company: 'Mumbai Plumbing Solutions', category: 'water_leakage', skills: '["water_leakage","drainage"]', lat: 19.070, lon: 72.870, address: '78 SV Road, Mumbai', exp: 6, rating: 3.8, jobs: 28 },
    { userId: 9, company: 'Green Clean Services', category: 'garbage', skills: '["garbage"]', lat: 19.085, lon: 72.890, address: '56 Hill Road, Mumbai', exp: 4, rating: 4.7, jobs: 38 },
    { userId: 10, company: 'Road Masters Pvt Ltd', category: 'road_damage', skills: '["road_damage","pothole","drainage"]', lat: 19.065, lon: 72.865, address: '90 Western Express, Mumbai', exp: 15, rating: 4.0, jobs: 85 },
  ];

  const insertVendor = db.prepare(
    'INSERT INTO vendors (user_id, company_name, category, skills, latitude, longitude, address, experience_years, rating_avg, total_jobs_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const v of vendorProfiles) {
    insertVendor.run(v.userId, v.company, v.category, v.skills, v.lat, v.lon, v.address, v.exp, v.rating, v.jobs);
  }
  console.log(`✅ Created ${vendorProfiles.length} vendor profiles`);

  // --- COMPLAINTS ---
  const complaints = [
    { userId: 2, category: 'pothole', desc: 'Large pothole on main road causing traffic issues and accidents. Approximately 3 meters wide.', lat: 19.075, lon: 72.877, status: 'completed' },
    { userId: 2, category: 'streetlight', desc: 'Streetlight not working near park entrance. Dark and dangerous at night.', lat: 19.078, lon: 72.880, status: 'in_progress' },
    { userId: 3, category: 'water_leakage', desc: 'Severe water pipe leakage on the main road. Water wasting continuously for 3 days.', lat: 19.072, lon: 72.873, status: 'assigned' },
    { userId: 3, category: 'garbage', desc: 'Garbage pile up near residential area. Unhygienic conditions and foul smell.', lat: 19.080, lon: 72.885, status: 'tender_created' },
    { userId: 4, category: 'road_damage', desc: 'Road surface completely damaged after heavy rains. Urgent repair needed.', lat: 19.068, lon: 72.868, status: 'tender_created' },
    { userId: 4, category: 'drainage', desc: 'Blocked drain causing waterlogging during rains. Mosquito breeding ground.', lat: 19.083, lon: 72.888, status: 'pending' },
    { userId: 5, category: 'electrical', desc: 'Exposed electrical wires near school. Very dangerous for children.', lat: 19.077, lon: 72.879, status: 'tender_created' },
    { userId: 5, category: 'pothole', desc: 'Multiple small potholes on the side road near market area.', lat: 19.074, lon: 72.876, status: 'pending' },
  ];

  const insertComplaint = db.prepare(
    'INSERT INTO complaints (user_id, category, description, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const c of complaints) {
    insertComplaint.run(c.userId, c.category, c.desc, c.lat, c.lon, c.status);
  }
  console.log(`✅ Created ${complaints.length} complaints`);

  // --- MICRO TENDERS ---
  const tenders = [
    { complaintId: 1, cost: 2100, priority: 'high', status: 'completed', vendorId: 1 },
    { complaintId: 2, cost: 3300, priority: 'medium', status: 'in_progress', vendorId: 2 },
    { complaintId: 3, cost: 2850, priority: 'high', status: 'assigned', vendorId: 3 },
    { complaintId: 4, cost: 1200, priority: 'medium', status: 'open', vendorId: null },
    { complaintId: 5, cost: 4500, priority: 'high', status: 'open', vendorId: null },
    { complaintId: 7, cost: 3800, priority: 'critical', status: 'open', vendorId: null },
  ];

  const insertTender = db.prepare(
    'INSERT INTO micro_tenders (complaint_id, estimated_cost, priority, status, assigned_vendor_id) VALUES (?, ?, ?, ?, ?)'
  );
  for (const t of tenders) {
    insertTender.run(t.complaintId, t.cost, t.priority, t.status, t.vendorId);
  }
  console.log(`✅ Created ${tenders.length} micro-tenders`);

  // --- APPLICATIONS ---
  const applications = [
    { tenderId: 1, vendorId: 1, bid: 1900, proposal: 'Can complete pothole repair within 2 days with quality materials.', status: 'accepted' },
    { tenderId: 1, vendorId: 5, bid: 2200, proposal: 'Professional road repair with 1-year warranty.', status: 'rejected' },
    { tenderId: 2, vendorId: 2, bid: 3000, proposal: 'LED streetlight replacement with 5-year warranty.', status: 'accepted' },
    { tenderId: 3, vendorId: 3, bid: 2500, proposal: 'Complete pipe repair with leak-proof guarantee.', status: 'accepted' },
    { tenderId: 4, vendorId: 4, bid: 1000, proposal: 'Quick garbage cleanup with proper disposal.', status: 'pending' },
    { tenderId: 5, vendorId: 1, bid: 4000, proposal: 'Full road resurfacing with heavy machinery.', status: 'pending' },
    { tenderId: 5, vendorId: 5, bid: 3800, proposal: 'Expert road repair team, 3-day completion.', status: 'pending' },
  ];

  const insertApp = db.prepare(
    'INSERT INTO applications (tender_id, vendor_id, bid_amount, proposal, status) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of applications) {
    insertApp.run(a.tenderId, a.vendorId, a.bid, a.proposal, a.status);
  }
  console.log(`✅ Created ${applications.length} applications`);

  // --- RATINGS ---
  db.prepare('INSERT INTO ratings (vendor_id, complaint_id, user_id, score, feedback) VALUES (?, ?, ?, ?, ?)')
    .run(1, 1, 2, 5, 'Excellent work! Pothole fixed perfectly.');
  console.log('✅ Created 1 rating');

  db.save();
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin:   admin@microtender.gov / password123');
  console.log('   Citizen: rajesh@gmail.com / password123');
  console.log('   Vendor:  vikram@vendor.com / password123\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
