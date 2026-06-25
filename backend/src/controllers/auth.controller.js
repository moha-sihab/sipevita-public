const authService = require('../services/auth.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');
const { createLogActivity } = require('../services/log.service');

const login = async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      throw new AppError('Nama pengguna dan kata sandi wajib diisi.', 400);
    }

    const result = await authService.login(username, password);
    await createLogActivity({
      id_pengguna: result.user.id_pengguna,
      jenis_aksi: 'LOGIN_SUCCESS',
      ip_address: req.ip,
      detail_aksi: 'Pengguna berhasil masuk.',
    });
    return successResponse(res, 'Login berhasil.', result);
  } catch (error) {
    await createLogActivity({
      id_pengguna: null,
      jenis_aksi: 'LOGIN_FAILED',
      ip_address: req.ip,
      detail_aksi: 'Proses masuk pengguna gagal.',
    });
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id_pengguna);
    return successResponse(res, 'Data pengguna aktif berhasil diambil.', { user });
  } catch (error) {
    return next(error);
  }
};

const protectedTest = (req, res) =>
  successResponse(res, 'Akses endpoint terlindungi berhasil diberikan.', {
    user: req.user,
  });

const roleTest = (req, res) =>
  successResponse(res, 'Akses peran berhasil diberikan.', {
    user: req.user,
  });

module.exports = {
  login,
  me,
  protectedTest,
  roleTest,
};
