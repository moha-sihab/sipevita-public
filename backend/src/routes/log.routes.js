const express = require('express');
const logController = require('../controllers/log.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorizeRoles = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('ATR_BPN'));

router.get('/', logController.getLogList);
router.get('/:id', logController.getLogDetail);

module.exports = router;
