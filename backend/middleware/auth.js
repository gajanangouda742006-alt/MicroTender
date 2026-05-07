const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'micro-tender-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
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

module.exports = { generateToken, authenticate, authorize, JWT_SECRET };
