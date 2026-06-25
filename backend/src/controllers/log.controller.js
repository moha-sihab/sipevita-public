const logService = require('../services/log.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const parsePositiveInteger = (value, fieldName, defaultValue, maximum = null) => {
  if (value === undefined) return defaultValue;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || (maximum && parsed > maximum)) {
    throw new AppError(`${fieldName} tidak valid.`, 400);
  }

  return parsed;
};

const parseDate = (value, fieldName) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} tidak valid.`, 400);
  }

  return date.toISOString();
};

const getLogList = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', 1);
    const limit = parsePositiveInteger(req.query.limit, 'limit', 20, 100);
    const idPengguna = req.query.id_pengguna
      ? parsePositiveInteger(req.query.id_pengguna, 'id_pengguna')
      : null;
    const startDate = parseDate(req.query.start_date, 'start_date');
    const endDate = parseDate(req.query.end_date, 'end_date');

    if (startDate && endDate && startDate > endDate) {
      throw new AppError('Tanggal awal harus sebelum atau sama dengan tanggal akhir.', 400);
    }

    const result = await logService.getLogList({
      page,
      limit,
      id_pengguna: idPengguna,
      jenis_aksi:
        typeof req.query.jenis_aksi === 'string' ? req.query.jenis_aksi.trim() : '',
      start_date: startDate,
      end_date: endDate,
      search: typeof req.query.search === 'string' ? req.query.search.trim() : '',
    });

    return successResponse(res, 'Daftar log aktivitas berhasil diambil.', result);
  } catch (error) {
    return next(error);
  }
};

const getLogDetail = async (req, res, next) => {
  try {
    const idLog = parsePositiveInteger(req.params.id, 'id_log');
    const log = await logService.getLogDetail(idLog);
    return successResponse(res, 'Detail log aktivitas berhasil diambil.', { log });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getLogList,
  getLogDetail,
};
