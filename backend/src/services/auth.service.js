const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const env = require('../config/env');
const AppError = require('../utils/app-error');

const USER_PROFILE_FIELDS =
  'id_pengguna, username, peran, nama_lengkap, status_aktif, created_at';

const isMissingOrPlaceholder = (value) => {
  const normalized = value.trim().toLowerCase();

  return (
    !normalized ||
    normalized.includes('your_') ||
    normalized.includes('placeholder') ||
    normalized.includes('dummy')
  );
};

const ensureSupabaseConfigured = () => {
  if (!supabase) {
    throw new AppError('Layanan basis data belum dikonfigurasi.', 503);
  }
};

const ensureJwtConfigured = () => {
  if (isMissingOrPlaceholder(env.jwtSecret)) {
    throw new AppError('Autentikasi JWT belum dikonfigurasi.', 503);
  }
};

const throwSafeQueryError = (error) => {
  if (error) {
    throw new AppError('Gagal mengambil data pengguna.', 503);
  }
};

const findUserByUsername = async (username) => {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('pengguna')
    .select(`${USER_PROFILE_FIELDS}, password_hash`)
    .eq('username', username)
    .maybeSingle();

  throwSafeQueryError(error);
  return data;
};

const findUserById = async (idPengguna) => {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('pengguna')
    .select(USER_PROFILE_FIELDS)
    .eq('id_pengguna', idPengguna)
    .maybeSingle();

  throwSafeQueryError(error);
  return data;
};

const toPublicUser = (user) => ({
  id_pengguna: user.id_pengguna,
  username: user.username,
  peran: user.peran,
  nama_lengkap: user.nama_lengkap,
  status_aktif: user.status_aktif,
  created_at: user.created_at,
});

const login = async (username, password) => {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new AppError('Nama pengguna atau kata sandi tidak valid.', 401);
  }

  if (!user.status_aktif) {
    throw new AppError('Akun pengguna tidak aktif.', 403);
  }

  const passwordIsValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordIsValid) {
    throw new AppError('Nama pengguna atau kata sandi tidak valid.', 401);
  }

  ensureJwtConfigured();

  const token = jwt.sign(
    {
      id_pengguna: user.id_pengguna,
      username: user.username,
      peran: user.peran,
    },
    env.jwtSecret,
    { expiresIn: '1d' }
  );

  return {
    token,
    user: toPublicUser(user),
  };
};

const getCurrentUser = async (idPengguna) => {
  const user = await findUserById(idPengguna);

  if (!user) {
    throw new AppError('Data pengguna tidak ditemukan.', 404);
  }

  if (!user.status_aktif) {
    throw new AppError('Akun pengguna tidak aktif.', 403);
  }

  return toPublicUser(user);
};

module.exports = {
  login,
  getCurrentUser,
};
