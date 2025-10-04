// utils/tokenUtils.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TTL = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10);
const REFRESH_TTL = parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10);

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function generateRandomToken() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRandomToken
};
