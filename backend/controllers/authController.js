const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUser, createUser, getUser, updateUser, deleteOtp } = require('../services/data');
const { sendSms } = require('../services/sms');
const { issueOtp, verifyOtp: checkOtp } = require('../services/otp');
const { createNotifications } = require('../services/notifications');
const { normalizePhone } = require('../utils/phone');
const dummyPasswordHash = bcrypt.hashSync('ARS invalid login comparison', 12);

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    duty: user.duty
  };
}

function issueToken(user, config) {
  return jwt.sign({ id: String(user._id), role: user.role, name: user.name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function signup(req, res) {
  const { name, phone: rawPhone, password } = req.validated.body;
  const phone = normalizePhone(rawPhone);
  if (await findUser({ phone })) return res.status(400).json({ error: { message: 'Unable to complete registration with these details.' } });
  const user = await createUser({
    name,
    phone,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'rescuer',
    status: 'pending',
    duty: 'off'
  });
  await createNotifications({
    app: req.app,
    role: 'admin',
    type: 'approval',
    message: `New rescuer registration: ${user.name}.`
  });
  res.status(201).json({ message: 'Registration submitted. An administrator must approve your account.' });
}

async function login(req, res) {
  const { phone: rawPhone, password, role } = req.validated.body;
  const user = await findUser({ phone: normalizePhone(rawPhone), role });
  const validPassword = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, dummyPasswordHash);
  if (!user || !validPassword) return res.status(401).json({ error: { message: 'Invalid mobile number or password' } });
  if (user.status === 'pending') return res.status(403).json({ error: { message: 'Your rescuer account is pending admin approval.' } });
  if (user.status === 'rejected') return res.status(403).json({ error: { message: 'Your rescuer account was not approved.' } });
  res.json({ token: issueToken(user, req.app.locals.config), user: publicUser(user) });
}

async function requestOtp(req, res) {
  const phone = normalizePhone(req.validated.body.phone);
  const otp = await issueOtp(phone, 'reset');
  if (!otp) {
    return res.status(429).json({ error: { message: 'Please wait before requesting another code.' } });
  }

  const userExists = await findUser({ phone });
  if (userExists) {
    try {
      await sendSms(req.app.locals.config, phone, `Your ARS password reset code is ${otp}. It expires in 5 minutes.`);
    } catch (error) {
      console.error('Password reset SMS delivery failed:', error.message);
      return res.status(502).json({ error: { message: 'The verification code could not be sent. Check the SMS provider settings and try again.' } });
    }
  }
  res.json({ message: 'If an account exists for that phone number, a verification code has been sent.' });
}

async function verifyOtp(req, res) {
  const phone = normalizePhone(req.validated.body.phone);
  const otpRecord = await checkOtp(phone, 'reset', req.validated.body.otp, { markVerified: true });
  if (!otpRecord) {
    return res.status(400).json({ error: { message: 'Invalid or expired verification code.' } });
  }
  res.json({ message: 'Code verified. You can now reset your password.' });
}

async function resetPassword(req, res) {
  const { phone: rawPhone, otp, password } = req.validated.body;
  const phone = normalizePhone(rawPhone);
  const otpRecord = await checkOtp(phone, 'reset', otp, { requireVerified: true });
  if (!otpRecord) {
    return res.status(400).json({ error: { message: 'Verify a valid code before resetting your password.' } });
  }
  const user = await findUser({ phone });
  if (!user) return res.status(400).json({ error: { message: 'Invalid reset request.' } });
  await updateUser(user._id, { passwordHash: await bcrypt.hash(password, 12) });
  await deleteOtp(otpRecord._id);
  res.json({ message: 'Password updated successfully.' });
}

async function me(req, res) {
  const user = await getUser(req.user.id);
  if (!user) return res.status(401).json({ error: { message: 'Session is no longer valid.' } });
  res.json({ user: publicUser(user) });
}

module.exports = { signup, login, requestOtp, verifyOtp, resetPassword, me };
