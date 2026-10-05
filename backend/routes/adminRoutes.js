const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { schemas } = require('../utils/validation');
const sosController = require('../controllers/sosController');
const adminController = require('../controllers/adminController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/rescuers', asyncHandler(adminController.rescuers));
router.patch('/rescuers/:id/approve', validate(schemas.userId), asyncHandler(adminController.approve));
router.patch('/rescuers/:id/reject', validate(schemas.userId), asyncHandler(adminController.reject));
router.get('/stats', asyncHandler(adminController.stats));
router.patch('/sos/:id/assign', validate(schemas.assignment), asyncHandler(sosController.assign));

module.exports = router;
