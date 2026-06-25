const express = require('express');
const reviewerController = require('../controllers/reviewer.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorizeRoles = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('ATR_BPN'));

router.get('/pengajuan', reviewerController.getPengajuanList);
router.get('/pengajuan/:id', reviewerController.getPengajuanDetail);
router.post('/pengajuan/:id/claim', reviewerController.claimPengajuan);
router.post('/pengajuan/:id/reject', reviewerController.rejectPengajuan);
router.post('/pengajuan/:id/approve', reviewerController.approvePengajuan);

module.exports = router;
