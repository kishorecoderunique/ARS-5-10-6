const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { schemas } = require('../utils/validation');
const controller = require('../controllers/notificationController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);
router.get('/', asyncHandler(controller.list));
router.patch('/read-all', asyncHandler(controller.markAllRead));
router.patch('/:id/read', validate(schemas.notificationId), asyncHandler(controller.markRead));

module.exports = router;
