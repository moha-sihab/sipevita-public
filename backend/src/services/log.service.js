const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');

const LOG_FIELDS =
  'id_log, id_pengguna, jenis_aksi, waktu_aksi, ip_address, detail_aksi';
const USER_FIELDS = 'id_pengguna, username, nama_lengkap, peran';
const MAX_DETAIL_LENGTH = 500;

const ensureSupabaseConfigured = () => {
  if (!supabase) {
    throw new AppError('Supabase belum dikonfigurasi.', 503);
  }
};

const ensureQuerySucceeded = (error, message) => {
  if (error) {
    throw new AppError(message, 503);
  }
};

const sanitizeDetail = (detail) => {
  if (typeof detail !== 'string') return null;

  return detail
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[REDACTED PRIVATE KEY]',
    )
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsb_secret_[A-Za-z0-9_-]+\b/g, '[REDACTED SERVICE KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED JWT]')
    .replace(
      /(password|token|secret|service[_ -]?role[_ -]?key|private[_ -]?key)\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]',
    )
    .slice(0, MAX_DETAIL_LENGTH);
};

const sanitizeLog = (log, profiles = new Map()) => ({
  id_log: log.id_log,
  id_pengguna: log.id_pengguna,
  jenis_aksi: log.jenis_aksi,
  waktu_aksi: log.waktu_aksi,
  ip_address: log.ip_address,
  detail_aksi: sanitizeDetail(log.detail_aksi),
  pengguna: profiles.get(log.id_pengguna) || null,
});

const sanitizeUserProfile = (user) => ({
  id_pengguna: user.id_pengguna,
  username: user.username,
  nama_lengkap: user.nama_lengkap,
  peran: user.peran,
});

const getUserProfiles = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('pengguna')
    .select(USER_FIELDS)
    .in('id_pengguna', uniqueIds);

  ensureQuerySucceeded(error, 'Gagal mengambil profil pengguna log');
  return new Map(
    (data || []).map((user) => [user.id_pengguna, sanitizeUserProfile(user)]),
  );
};

const createLogActivity = async ({
  id_pengguna,
  jenis_aksi,
  ip_address,
  detail_aksi,
}) => {
  if (!supabase) {
    console.error('Log aktivitas gagal dicatat: klien Supabase belum dikonfigurasi.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('log_aktivitas')
      .insert({
        id_pengguna: id_pengguna || null,
        jenis_aksi,
        ip_address: ip_address || null,
        detail_aksi: sanitizeDetail(detail_aksi),
      })
      .select(LOG_FIELDS)
      .single();

    if (error) {
      console.error('Log aktivitas gagal dicatat:', error.message);
      return null;
    }

    return sanitizeLog(data);
  } catch (error) {
    console.error('Log aktivitas gagal dicatat:', error.message);
    return null;
  }
};

const getLogList = async (filters) => {
  ensureSupabaseConfigured();

  const offset = (filters.page - 1) * filters.limit;
  let query = supabase
    .from('log_aktivitas')
    .select(LOG_FIELDS, { count: 'exact' })
    .order('waktu_aksi', { ascending: false });

  if (filters.jenis_aksi) query = query.eq('jenis_aksi', filters.jenis_aksi);
  if (filters.id_pengguna) query = query.eq('id_pengguna', filters.id_pengguna);
  if (filters.start_date) query = query.gte('waktu_aksi', filters.start_date);
  if (filters.end_date) query = query.lte('waktu_aksi', filters.end_date);
  if (filters.search) query = query.ilike('detail_aksi', `%${filters.search}%`);

  const { data, error, count } = await query.range(offset, offset + filters.limit - 1);
  ensureQuerySucceeded(error, 'Gagal mengambil daftar log aktivitas');

  const logs = data || [];
  const profiles = await getUserProfiles(logs.map((log) => log.id_pengguna));
  const total = count || 0;

  return {
    items: logs.map((log) => sanitizeLog(log, profiles)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.ceil(total / filters.limit),
    },
  };
};

const getLogDetail = async (idLog) => {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('log_aktivitas')
    .select(LOG_FIELDS)
    .eq('id_log', idLog)
    .maybeSingle();

  ensureQuerySucceeded(error, 'Gagal mengambil detail log aktivitas');

  if (!data) {
    throw new AppError('Log aktivitas tidak ditemukan.', 404);
  }

  const profiles = await getUserProfiles([data.id_pengguna]);
  return sanitizeLog(data, profiles);
};

module.exports = {
  createLogActivity,
  getLogList,
  getLogDetail,
};
