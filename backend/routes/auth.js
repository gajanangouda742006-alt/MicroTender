const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, generateRefreshToken, authenticate, logActivity, REFRESH_TOKEN_EXPIRES_DAYS } = require('../middleware/auth');

const router = express.Router();

function validateGovtId(type, number) {
  if (!type || !number) return { valid: true };
  const patterns = { aadhaar: /^\d{12}$/, pan: /^[A-Z]{5}\d{4}[A-Z]$/ };
  const pattern = patterns[type.toLowerCase()];
  if (!pattern) return { valid: false, message: 'Invalid ID type. Use aadhaar or pan.' };
  if (!pattern.test(number)) return { valid: false, message: `Invalid ${type} format.` };
  return { valid: true };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, govt_id_type, govt_id_number } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    if (role && !['citizen', 'vendor', 'admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role.' });
    if (govt_id_type || govt_id_number) {
      const govCheck = validateGovtId(govt_id_type, govt_id_number);
      if (!govCheck.valid) return res.status(400).json({ error: govCheck.message });
    }
    const existing = await db.get('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered.' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (name, email, phone, password, role, govt_id_type, govt_id_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, hashedPassword, role || 'citizen', govt_id_type || null, govt_id_number || null]
    );
    const user = await db.get(
      'SELECT user_id, name, email, role, reputation_score, created_at FROM users WHERE user_id = ?',
      [result.insertId]
    );
    const token = generateToken(user);

    // Generate refresh token and store in DB
    const refreshToken = generateRefreshToken();
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.user_id, refreshToken, refreshExpiry]);

    // Store session
    const sessionExpiry = refreshExpiry;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await db.run('INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)', [user.user_id, token, ip, ua, sessionExpiry]);

    // Log activity
    await logActivity(db, user.user_id, 'register', `User registered as ${user.role}`, ip);

    res.status(201).json({ message: 'Registration successful', token, refreshToken, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated.' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = generateToken(user);

    // Generate refresh token and store in DB
    const refreshToken = generateRefreshToken();
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.user_id, refreshToken, refreshExpiry]);

    // Store session
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await db.run('INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)', [user.user_id, token, ip, ua, refreshExpiry]);

    // Log activity
    await logActivity(db, user.user_id, 'login', 'User logged in', ip);

    const { password: _, otp_code: __, ...safeUser } = user;
    res.json({ message: 'Login successful', token, refreshToken, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/refresh - Exchange refresh token for new access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required.' });

    const stored = await db.get('SELECT * FROM refresh_tokens WHERE token = ?', [refreshToken]);
    if (!stored) return res.status(401).json({ error: 'Invalid refresh token.' });
    if (new Date(stored.expires_at) < new Date()) {
      await db.run('DELETE FROM refresh_tokens WHERE token_id = ?', [stored.token_id]);
      return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
    }

    const user = await db.get('SELECT user_id, name, email, role, reputation_score FROM users WHERE user_id = ?', [stored.user_id]);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    // Issue new access token
    const newAccessToken = generateToken(user);

    // Rotate refresh token (security best practice)
    const newRefreshToken = generateRefreshToken();
    const newExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db.run('DELETE FROM refresh_tokens WHERE token_id = ?', [stored.token_id]);
    await db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.user_id, newRefreshToken, newExpiry]);

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    await logActivity(db, user.user_id, 'token_refresh', 'Access token refreshed', ip);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken, user });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    // Delete refresh token
    if (refreshToken) {
      await db.run('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?', [refreshToken, req.user.user_id]);
    }
    // Delete session
    await db.run('DELETE FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.user_id]);

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    await logActivity(db, req.user.user_id, 'logout', 'User logged out', ip);

    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed.' });
  }
});

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const user = await db.get('SELECT user_id FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const otp = '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db.run('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE email = ?', [otp, expiresAt, email]);
    res.json({ message: 'OTP sent successfully (demo: 123456)', expires_in: '10 minutes' });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.otp_code !== otp) return res.status(401).json({ error: 'Invalid OTP.' });
    if (new Date(user.otp_expires_at) < new Date()) return res.status(401).json({ error: 'OTP expired.' });
    await db.run('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?', [user.user_id]);
    const token = generateToken(user);
    res.json({ message: 'OTP verified', token });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT user_id, name, email, phone, role, govt_id_type, govt_id_number, reputation_score, is_active, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    let vendorProfile = null;
    if (user.role === 'vendor') {
      vendorProfile = await db.get('SELECT * FROM vendors WHERE user_id = ?', [user.user_id]);
    }
    res.json({ user, vendorProfile });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

module.exports = router;
