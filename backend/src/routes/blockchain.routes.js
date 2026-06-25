const express = require('express');
const blockchainController = require('../controllers/blockchain.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorizeRoles = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('PPAT', 'ATR_BPN'));

router.get('/status', blockchainController.getNetworkStatus);
router.get('/verify/:nomorSertifikat', blockchainController.verifyLand);
router.get('/history/:nomorSertifikat', blockchainController.getLandHistory);

module.exports = router;
