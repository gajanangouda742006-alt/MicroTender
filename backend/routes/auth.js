const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// Validate government ID format
function validateGovtId(type, number) {
  if (!type || !number) return { valid: true }; // Optional
  const patterns = {
    aadhaar: /^\d{12}$/,
    pan: /^[A-Z]{5}\d{4}[A-Z]$/
  };
  const pattern = patterns[type.toLowerCase()];
  if (!pattern) return { valid: false, message: 'Invalid ID type. Use aadhaar or pan.' };
  if (!pattern.test(number)) return { valid: false, message: `Invalid ${type} format.` };
  return { valid: true };
}

/**
 * POST /api/auth/register
 * Register a new user (citizen, vendor, or admin)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, govt_id_type, govt_id_number } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (role && !['citizen', 'vendor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    // Validate government ID if provided
    if (govt_id_type || govt_id_number) {
      const govCheck = validateGovtId(govt_id_type, govt_id_number);
      if (!govCheck.valid) return res.status(400).json({ error: govCheck.message });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password, role, govt_id_type, govt_id_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone || null, hashedPassword, role || 'citizen', govt_id_type || null, govt_id_number || null);

    const user = db.prepare('SELECT user_id, name, email, role, reputation_score, created_at FROM users WHERE user_id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({ message: 'Registration successful', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

/**
 * POST /api/auth/login
 * Login with email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    const { password: _, otp_code: __, ...safeUser } = user;

    res.json({ message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * POST /api/auth/send-otp
 * Mock OTP sending
 */
router.post('/send-otp', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Mock OTP (always 123456 for demo)
    const otp = '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE email = ?')
      .run(otp, expiresAt, email);

    res.json({ message: 'OTP sent successfully (demo: 123456)', expires_in: '10 minutes' });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

/**
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.otp_code !== otp) {
      return res.status(401).json({ error: 'Invalid OTP.' });
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      return res.status(401).json({ error: 'OTP expired.' });
    }

    // Clear OTP
    db.prepare('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?')
      .run(user.user_id);

    const token = generateToken(user);
    res.json({ message: 'OTP verified', token });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'OTP verification failed.' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT user_id, name, email, phone, role, govt_id_type, govt_id_number,
             reputation_score, is_active, created_at
      FROM users WHERE user_id = ?
    `).get(req.user.user_id);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    // If vendor, include vendor profile
    let vendorProfile = null;
    if (user.role === 'vendor') {
      vendorProfile = db.prepare('SELECT * FROM vendors WHERE user_id = ?').get(user.user_id);
    }

    res.json({ user, vendorProfile });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

module.exports = router;
