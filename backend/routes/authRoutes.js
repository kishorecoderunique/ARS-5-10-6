const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { schemas } = require('../utils/validation');
const controller = require('../controllers/authController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many login attempts. Try again later.' } } });
const otpLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many verification requests. Try again later.' } } });

router.post('/signup', validate(schemas.signup), asyncHandler(controller.signup));
router.post('/login', loginLimit, validate(schemas.login), asyncHandler(controller.login));
router.post('/forgot/request-otp', otpLimit, validate(schemas.otpRequest), asyncHandler(controller.requestOtp));
router.post('/forgot/verify-otp', otpLimit, validate(schemas.otpVerify), asyncHandler(controller.verifyOtp));
router.post('/forgot/reset-password', otpLimit, validate(schemas.otpReset), asyncHandler(controller.resetPassword));
router.get('/me', requireAuth, asyncHandler(controller.me));

module.exports = router;
