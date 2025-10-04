// middleware/auth.js
const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

async function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = auth.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    // attach minimal user info
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      company: payload.company
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { authenticateJWT, authorize };
