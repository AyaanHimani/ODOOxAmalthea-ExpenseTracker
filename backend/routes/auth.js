// routes/auth.js
const express = require('express');
const router = express.Router();
const { signup, login, forgotPassword, refreshToken, logout, me } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticateJWT, me);

module.exports = router;
