const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { schemas } = require('../utils/validation');
const { asyncHandler } = require('../utils/asyncHandler');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.patch('/duty', requireAuth, requireRole('rescuer'), validate(schemas.duty), asyncHandler(adminController.setDuty));

module.exports = router;
