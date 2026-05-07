/**
 * Database Module - sql.js wrapper with better-sqlite3 compatible API
 * Uses sql.js (pure JavaScript SQLite) for zero-dependency installation.
 * Provides .prepare().run/get/all() API matching better-sqlite3.
 */
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'microtender.db');
const dataDir = path.dirname(DB_PATH);

let rawDb = null;
let saveTimer = null;

// The wrapper object - this is what gets exported and used by all routes
const wrapper = {};

/**
 * Initialize the database (must be called before server starts)
 */
wrapper.initDatabase = async function () {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buffer);
  } else {
    rawDb = new SQL.Database();
  }

  rawDb.run('PRAGMA foreign_keys = ON');

  // Create schema
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('citizen', 'vendor', 'admin')) NOT NULL DEFAULT 'citizen',
      govt_id_type TEXT,
      govt_id_number TEXT,
      otp_code TEXT,
      otp_expires_at TEXT,
      reputation_score REAL DEFAULT 100.0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      image_url TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','under_review','tender_created','assigned','in_progress','completed','rejected')),
      admin_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS micro_tenders (
      tender_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL UNIQUE,
      estimated_cost REAL,
      manual_cost REAL,
      selected_cost_type TEXT DEFAULT 'ai' CHECK(selected_cost_type IN ('ai', 'manual')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open','assigned','in_progress','completed','cancelled')),
      assigned_vendor_id INTEGER,
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vendors (
      vendor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      company_name TEXT,
      category TEXT,
      skills TEXT DEFAULT '[]',
      latitude REAL,
      longitude REAL,
      address TEXT,
      experience_years INTEGER DEFAULT 0,
      rating_avg REAL DEFAULT 0.0,
      total_ratings INTEGER DEFAULT 0,
      total_jobs_completed INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      application_id INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      bid_amount REAL NOT NULL,
      proposal TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tender_id) REFERENCES micro_tenders(tender_id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE,
      UNIQUE(tender_id, vendor_id)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      complaint_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER CHECK(score >= 1 AND score <= 5) NOT NULL,
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE(complaint_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS fraud_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'low' CHECK(severity IN ('low','medium','high','critical')),
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  // Create indexes (ignore errors if they exist)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)',
    'CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category)',
    'CREATE INDEX IF NOT EXISTS idx_tenders_status ON micro_tenders(status)',
    'CREATE INDEX IF NOT EXISTS idx_tenders_complaint ON micro_tenders(complaint_id)',
    'CREATE INDEX IF NOT EXISTS idx_vendors_user ON vendors(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category)',
    'CREATE INDEX IF NOT EXISTS idx_applications_tender ON applications(tender_id)',
    'CREATE INDEX IF NOT EXISTS idx_applications_vendor ON applications(vendor_id)',
    'CREATE INDEX IF NOT EXISTS idx_ratings_vendor ON ratings(vendor_id)',
    'CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)',
  ];
  for (const idx of indexes) {
    try { rawDb.run(idx); } catch (e) { /* ignore */ }
  }

  // Attach wrapper methods
  _attachMethods();

  // Auto-save every 3 seconds
  saveTimer = setInterval(() => wrapper.save(), 3000);

  console.log('✅ Database initialized');
  return wrapper;
};

/**
 * Save database to disk
 */
wrapper.save = function () {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('DB save error:', e.message);
  }
};

function _attachMethods() {
  /**
   * Prepare a SQL statement - returns object with run/get/all methods
   * Compatible with better-sqlite3 API
   */
  wrapper.prepare = function (sql) {
    return {
      run: function (...params) {
        try {
          if (params.length > 0) {
            rawDb.run(sql, params);
          } else {
            rawDb.run(sql);
          }
          const res = rawDb.exec('SELECT last_insert_rowid() as id, changes() as ch');
          const lastInsertRowid = res.length > 0 ? res[0].values[0][0] : 0;
          const changes = res.length > 0 ? res[0].values[0][1] : 0;
          wrapper.save(); // save after writes
          return { lastInsertRowid, changes };
        } catch (e) {
          console.error('DB run error:', sql, params, e.message);
          throw e;
        }
      },
      get: function (...params) {
        let stmt;
        try {
          stmt = rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          if (stmt) try { stmt.free(); } catch (_) {}
          console.error('DB get error:', sql, params, e.message);
          throw e;
        }
      },
      all: function (...params) {
        let stmt;
        try {
          stmt = rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (e) {
          if (stmt) try { stmt.free(); } catch (_) {}
          console.error('DB all error:', sql, params, e.message);
          throw e;
        }
      }
    };
  };

  /**
   * Execute raw SQL (multi-statement support)
   */
  wrapper.exec = function (sql) {
    rawDb.exec(sql);
    wrapper.save();
  };

  /**
   * No-op pragma (sql.js handles differently)
   */
  wrapper.pragma = function () {};
}

module.exports = wrapper;
