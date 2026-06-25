const express = require('express');
const publicController = require('../controllers/public.controller');
const { publicRateLimit } = require('../middlewares/rateLimit.middleware');
const { verifyTurnstile } = require('../middlewares/turnstile.middleware');

const router = express.Router();

router.use(publicRateLimit);
router.get('/verify', verifyTurnstile, publicController.verifyCertificate);
router.post('/verify', verifyTurnstile, publicController.verifyCertificate);
router.get('/history', verifyTurnstile, publicController.getCertificateHistory);
router.post('/history', verifyTurnstile, publicController.getCertificateHistory);

module.exports = router;
