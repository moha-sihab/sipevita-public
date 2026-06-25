const express = require('express');
const pengajuanController = require('../controllers/pengajuan.controller');
const dokumenController = require('../controllers/dokumen.controller');
const authenticate = require('../middlewares/auth.middleware');
const authorizeRoles = require('../middlewares/role.middleware');
const { uploadFields } = require('../middlewares/upload.middleware');

const router = express.Router();

// PPAT-only routes
router.post('/', authenticate, authorizeRoles('PPAT'), pengajuanController.createPengajuan);
router.get('/', authenticate, authorizeRoles('PPAT'), pengajuanController.getPengajuanList);
router.get('/:id', authenticate, authorizeRoles('PPAT'), pengajuanController.getPengajuanDetail);
router.post('/:id/submit', authenticate, authorizeRoles('PPAT'), pengajuanController.submitPengajuan);

// POST /api/pengajuan/:idPengajuan/dokumen/upload
// Multipart: field "files" (multiple), field "documentMetadata" (JSON string)
router.post(
  '/:idPengajuan/dokumen/upload',
  authenticate,
  authorizeRoles('PPAT'),
  uploadFields,
  dokumenController.uploadDokumen
);

// GET /api/pengajuan/:idPengajuan/dokumen
// Allowed: PPAT owner of the application, or ATR_BPN assigned as reviewer
router.get(
  '/:idPengajuan/dokumen',
  authenticate,
  authorizeRoles('PPAT', 'ATR_BPN'),
  dokumenController.listDokumen
);

// GET /api/pengajuan/:idPengajuan/dokumen/:idDokumen/download
router.get(
  '/:idPengajuan/dokumen/:idDokumen/download',
  authenticate,
  authorizeRoles('PPAT', 'ATR_BPN'),
  dokumenController.downloadDokumen
);

// GET /api/pengajuan/:idPengajuan/dokumen/:idDokumen/preview
router.get(
  '/:idPengajuan/dokumen/:idDokumen/preview',
  authenticate,
  authorizeRoles('PPAT', 'ATR_BPN'),
  dokumenController.previewDokumen
);

module.exports = router;
