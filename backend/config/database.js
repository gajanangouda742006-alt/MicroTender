/**
 * Database Module - MySQL (mysql2/promise) connection pool
 * Replaces the former sql.js (SQLite) wrapper.
 * All methods are async.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

const db = {};

/**
 * Initialize MySQL connection pool and create schema
 */
db.initDatabase = async function () {
  const dbName = process.env.DB_NAME || 'micro_tender_db';

  // 1. Connect without database first to ensure the database exists
  try {
    const setupConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT) || 3306,
    });
    await setupConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await setupConn.end();
  } catch (err) {
    console.warn('⚠️ Could not auto-create database (it may already exist or user lacks permission):', err.message);
  }

  // 2. Initialize connection pool
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
  });

  // Test connection
  const conn = await pool.getConnection();
  console.log('✅ MySQL connected successfully');
  conn.release();

  // Create schema
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password TEXT NOT NULL,
      role ENUM('citizen', 'vendor', 'admin') NOT NULL DEFAULT 'citizen',
      govt_id_type VARCHAR(50),
      govt_id_number VARCHAR(100),
      otp_code VARCHAR(10),
      otp_expires_at DATETIME,
      reputation_score DOUBLE DEFAULT 100.0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      latitude DOUBLE,
      longitude DOUBLE,
      image_url TEXT,
      status ENUM('pending','under_review','tender_created','assigned','in_progress','completed','rejected') DEFAULT 'pending',
      admin_notes TEXT,
      ai_analysis LONGTEXT,
      department VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS micro_tenders (
      tender_id INT PRIMARY KEY AUTO_INCREMENT,
      complaint_id INT NOT NULL UNIQUE,
      estimated_cost DOUBLE,
      manual_cost DOUBLE,
      selected_cost_type ENUM('ai', 'manual') DEFAULT 'ai',
      priority ENUM('low','medium','high','critical') DEFAULT 'medium',
      status ENUM('open','assigned','in_progress','completed','cancelled') DEFAULT 'open',
      assigned_vendor_id INT,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS vendors (
      vendor_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      company_name VARCHAR(255),
      category VARCHAR(100),
      skills TEXT,
      latitude DOUBLE,
      longitude DOUBLE,
      address TEXT,
      experience_years INT DEFAULT 0,
      rating_avg DOUBLE DEFAULT 0.0,
      total_ratings INT DEFAULT 0,
      total_jobs_completed INT DEFAULT 0,
      is_available TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      application_id INT PRIMARY KEY AUTO_INCREMENT,
      tender_id INT NOT NULL,
      vendor_id INT NOT NULL,
      bid_amount DOUBLE NOT NULL,
      proposal TEXT,
      status ENUM('pending','accepted','rejected') DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tender_id) REFERENCES micro_tenders(tender_id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE,
      UNIQUE KEY uq_tender_vendor (tender_id, vendor_id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ratings (
      rating_id INT PRIMARY KEY AUTO_INCREMENT,
      vendor_id INT NOT NULL,
      complaint_id INT NOT NULL,
      user_id INT NOT NULL,
      score INT NOT NULL CHECK (score >= 1 AND score <= 5),
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE KEY uq_complaint_user (complaint_id, user_id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS fraud_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      type VARCHAR(100) NOT NULL,
      description TEXT,
      severity ENUM('low','medium','high','critical') DEFAULT 'low',
      resolved TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS work_updates (
      update_id INT PRIMARY KEY AUTO_INCREMENT,
      tender_id INT NOT NULL,
      vendor_id INT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      latitude DOUBLE,
      longitude DOUBLE,
      progress_percentage INT DEFAULT 0,
      verification_status VARCHAR(50) DEFAULT 'verified',
      verification_reasoning TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tender_id) REFERENCES micro_tenders(tender_id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
    )
  `);

  try {
    await pool.execute(`ALTER TABLE work_updates ADD COLUMN verification_status VARCHAR(50) DEFAULT 'verified'`);
    await pool.execute(`ALTER TABLE work_updates ADD COLUMN verification_reasoning TEXT`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Migrate users table columns if they do not exist
  try { await pool.execute(`ALTER TABLE users ADD COLUMN govt_id_type VARCHAR(50)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE users ADD COLUMN govt_id_number VARCHAR(100)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE users ADD COLUMN reputation_score DOUBLE DEFAULT 100.0`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE users ADD COLUMN otp_code VARCHAR(10)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE users ADD COLUMN otp_expires_at DATETIME`); } catch (e) {}

  // Migrate vendors table columns if they do not exist
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN company_name VARCHAR(255)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN category VARCHAR(100)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN skills TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN latitude DOUBLE`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN longitude DOUBLE`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN address TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN experience_years INT DEFAULT 0`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN rating_avg DOUBLE DEFAULT 0.0`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN total_ratings INT DEFAULT 0`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN total_jobs_completed INT DEFAULT 0`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE vendors ADD COLUMN is_available TINYINT(1) DEFAULT 1`); } catch (e) {}

  // Migrate complaints table columns if they do not exist
  try { await pool.execute(`ALTER TABLE complaints ADD COLUMN latitude DOUBLE`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE complaints ADD COLUMN longitude DOUBLE`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE complaints ADD COLUMN admin_notes TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE complaints ADD COLUMN ai_analysis LONGTEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE complaints ADD COLUMN department VARCHAR(255)`); } catch (e) {}

  // Migrate micro_tenders table columns if they do not exist
  try { await pool.execute(`ALTER TABLE micro_tenders ADD COLUMN manual_cost DOUBLE`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE micro_tenders ADD COLUMN selected_cost_type ENUM('ai', 'manual') DEFAULT 'ai'`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE micro_tenders ADD COLUMN deadline DATETIME`); } catch (e) {}

  // Migrate sessions table columns if they do not exist
  try { await pool.execute(`ALTER TABLE sessions ADD COLUMN token TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE sessions ADD COLUMN ip_address VARCHAR(45)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE sessions ADD COLUMN user_agent TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE sessions ADD COLUMN expires_at DATETIME`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE sessions MODIFY COLUMN session_id INT AUTO_INCREMENT`); } catch (e) {}

  // Migrate refresh_tokens table columns if they do not exist
  try { await pool.execute(`ALTER TABLE refresh_tokens ADD COLUMN token VARCHAR(255)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE refresh_tokens ADD COLUMN expires_at DATETIME`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE refresh_tokens MODIFY COLUMN token_id INT AUTO_INCREMENT`); } catch (e) {}

  // Migrate activity_logs table columns if they do not exist
  try { await pool.execute(`ALTER TABLE activity_logs ADD COLUMN details TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE activity_logs ADD COLUMN ip_address VARCHAR(45)`); } catch (e) {}

  // Migrate admin_logs table columns if they do not exist
  try { await pool.execute(`ALTER TABLE admin_logs ADD COLUMN target_id INT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE admin_logs ADD COLUMN target_type VARCHAR(100)`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE admin_logs ADD COLUMN details TEXT`); } catch (e) {}

  // Migrate fraud_logs table columns if they do not exist
  try { await pool.execute(`ALTER TABLE fraud_logs ADD COLUMN description TEXT`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE fraud_logs ADD COLUMN severity ENUM('low','medium','high','critical') DEFAULT 'low'`); } catch (e) {}
  try { await pool.execute(`ALTER TABLE fraud_logs ADD COLUMN resolved TINYINT(1) DEFAULT 0`); } catch (e) {}

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token TEXT NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      admin_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      target_id INT,
      target_type VARCHAR(100),
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS system_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      level VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      action VARCHAR(255) NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      row_id INT,
      old_values TEXT,
      new_values TEXT,
      ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )
  `);

  // Indexes (ignore if already exist)
  const indexes = [
    `CREATE INDEX idx_complaints_user ON complaints(user_id)`,
    `CREATE INDEX idx_complaints_status ON complaints(status)`,
    `CREATE INDEX idx_complaints_category ON complaints(category)`,
    `CREATE INDEX idx_tenders_status ON micro_tenders(status)`,
    `CREATE INDEX idx_tenders_complaint ON micro_tenders(complaint_id)`,
    `CREATE INDEX idx_vendors_user ON vendors(user_id)`,
    `CREATE INDEX idx_vendors_category ON vendors(category)`,
    `CREATE INDEX idx_applications_tender ON applications(tender_id)`,
    `CREATE INDEX idx_applications_vendor ON applications(vendor_id)`,
    `CREATE INDEX idx_ratings_vendor ON ratings(vendor_id)`,
    `CREATE INDEX idx_fraud_user ON fraud_logs(user_id)`,
    `CREATE INDEX idx_notifications_user ON notifications(user_id)`,
    `CREATE INDEX idx_notifications_read ON notifications(is_read)`,
  ];
  for (const idx of indexes) {
    try { await pool.execute(idx); } catch (e) { /* ignore duplicate index errors */ }
  }

  console.log('✅ Database schema ready (MySQL)');
  return db;
};

/**
 * Execute a query returning a single row (or undefined)
 */
db.get = async function (sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0];
};

/**
 * Execute a query returning all rows
 */
db.all = async function (sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Execute a write query (INSERT, UPDATE, DELETE)
 * Returns { insertId, affectedRows }
 */
db.run = async function (sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
};

/**
 * Execute raw SQL (for multi-statement admin use)
 */
db.exec = async function (sql) {
  await pool.query(sql);
};

/**
 * No-op: MySQL auto-persists, no manual save needed
 */
db.save = function () {};

/**
 * Get the raw pool (for transactions if needed in future)
 */
db.getPool = function () { return pool; };

module.exports = db;
