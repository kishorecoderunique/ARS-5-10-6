const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { reserveOtp, incrementOtpAttempts, markOtpVerified } = require('./data');

async function issueOtp(phone, purpose) {
  const now = new Date();
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = await bcrypt.hash(otp, 10);
  const record = await reserveOtp(phone, purpose, otpHash, now);
  return record ? otp : null;
}

async function verifyOtp(phone, purpose, otp, { markVerified = false, requireVerified = false } = {}) {
  const now = new Date();
  const record = await incrementOtpAttempts(phone, purpose, now, requireVerified);
  if (!record || !await bcrypt.compare(otp, record.otpHash)) return null;
  if (markVerified) return markOtpVerified(record._id, now);
  return record;
}

module.exports = { issueOtp, verifyOtp };
