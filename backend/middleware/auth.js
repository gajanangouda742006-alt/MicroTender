const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'micro-tender-secret-key-2026';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/**
 * Generate JWT access token for a user (short-lived)
 */
function generateToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate a secure random refresh token string
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Log user activity into activity_logs table
 */
async function logActivity(db, userId, action, details, ipAddress) {
  try {
    await db.run(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [userId, action, details || null, ipAddress || null]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

/**
 * Log admin action into admin_logs table
 */
async function logAdminAction(db, adminId, action, targetId, targetType, details) {
  try {
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, target_id, target_type, details) VALUES (?, ?, ?, ?, ?)',
      [adminId, action, targetId || null, targetType || null, details || null]
    );
  } catch (err) {
    console.error('Admin log error:', err.message);
  }
}

/**
 * Middleware: Verify JWT token
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware: Authorize specific roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { generateToken, generateRefreshToken, authenticate, authorize, logActivity, logAdminAction, JWT_SECRET, REFRESH_TOKEN_EXPIRES_DAYS };
