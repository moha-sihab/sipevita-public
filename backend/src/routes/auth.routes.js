const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorizeRoles = require('../middlewares/role.middleware');
const { verifyTurnstile } = require('../middlewares/turnstile.middleware');

const router = express.Router();

router.post('/login', verifyTurnstile, authController.login);
router.get('/me', authenticate, authController.me);

// Temporary development endpoints for validating authentication and roles.
router.get('/protected', authenticate, authController.protectedTest);
router.get('/test/ppat', authenticate, authorizeRoles('PPAT'), authController.roleTest);
router.get('/test/atr-bpn', authenticate, authorizeRoles('ATR_BPN'), authController.roleTest);

module.exports = router;
