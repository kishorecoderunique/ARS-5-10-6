const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole, requireAnyRole } = require('../middleware/auth');
const { schemas } = require('../utils/validation');
const controller = require('../controllers/sosController');
const { asyncHandler } = require('../utils/asyncHandler');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();
const ipCreateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many SOS requests from this network. Try again later.' } }
});
const phoneCreateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => normalizePhone(req.body?.victimPhone),
  message: { error: { message: 'Too many SOS requests for this phone number. Try again later.' } }
});

router.post('/', ipCreateLimit, phoneCreateLimit, validate(schemas.createSos), asyncHandler(controller.create));
router.get('/mine', requireAuth, requireRole('rescuer'), asyncHandler(controller.mine));
router.get('/:id/location', requireAuth, requireAnyRole('rescuer', 'admin'), validate(schemas.sosId), asyncHandler(controller.location));
router.get('/', requireAuth, requireAnyRole('rescuer', 'admin'), validate(schemas.sosQuery), asyncHandler(controller.list));
router.patch('/:id/accept', requireAuth, requireRole('rescuer'), validate(schemas.sosId), asyncHandler(controller.accept));
router.patch('/:id/status', requireAuth, requireRole('rescuer'), validate(schemas.status), asyncHandler(controller.updateStatus));

module.exports = router;
