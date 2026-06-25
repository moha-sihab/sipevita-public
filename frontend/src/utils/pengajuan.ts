import type { BlockchainDetailNotice, ListResponse, Pengajuan } from '../types/api';
import { getStatus, normalizeStatus } from './format';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstRecord = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = asRecord(record[key]);
    if (value) return value;
  }
  return undefined;
};

const firstArray = (records: Array<Record<string, unknown>>, keys: string[]) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    }
  }
  return undefined;
};

const firstValue = (records: Array<Record<string, unknown>>, keys: string[]) => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
};

export const normalizePengajuan = (value: unknown): Pengajuan => {
  const response = asRecord(value) || {};
  const nested = firstRecord(response, ['pengajuan', 'item', 'detail']) || response;
  const records = [nested, response];
  const id = firstValue(records, ['id_pengajuan', 'id']);
  const status = firstValue(records, ['status_pengajuan', 'status']);

  return {
    ...response,
    ...nested,
    id_pengajuan: id === undefined ? undefined : Number(id),
    status_pengajuan: status === undefined ? undefined : String(status),
    pihak_transaksi: firstArray(records, ['pihak_transaksi', 'pihak']) || nested.pihak_transaksi as Pengajuan['pihak_transaksi'],
    dokumen: firstArray(records, ['dokumen', 'documents']) || nested.dokumen as Pengajuan['dokumen'],
    transaksi_blockchain:
      firstRecord(nested, [
        'transaksi_blockchain',
        'blockchain_transaction',
        'blockchainTransaction',
        'blockchain',
      ]) ||
      firstRecord(response, [
        'transaksi_blockchain',
        'blockchain_transaction',
        'blockchainTransaction',
        'blockchain',
      ]) ||
      null,
  };
};

export const normalizePengajuanList = (value: unknown): ListResponse<Pengajuan> => {
  const response = asRecord(value) || {};
  const rawItems = Array.isArray(response.items)
    ? response.items
    : Array.isArray(response.pengajuan)
      ? response.pengajuan
      : [];

  return {
    ...response,
    items: rawItems.map(normalizePengajuan),
    count: Number(response.count ?? response.total ?? rawItems.length),
  } as ListResponse<Pengajuan>;
};

const normalizeBlockchainTransaction = (
  transaction: Record<string, unknown>,
  item: Pengajuan,
) => ({
  ...transaction,
  transaction_id:
    transaction.transaction_id ||
    transaction.tx_id ||
    transaction.hash_transaksi ||
    transaction.id_transaksi,
  timestamp:
    transaction.timestamp ||
    transaction.timestamp_blockchain ||
    transaction.created_at,
  cid_ipfs:
    transaction.cid_ipfs ||
    item.dokumen?.find((document) => document.cid_ipfs)?.cid_ipfs,
});

export const getBlockchainDetailPresentation = (
  item: Pengajuan,
): { item: Pengajuan; notice?: BlockchainDetailNotice } => {
  const status = getStatus(item);
  const transaction = asRecord(item.transaksi_blockchain);

  if (transaction) {
    const confirmationStatus = normalizeStatus(
      transaction.status_konfirmasi || transaction.confirmation_status,
    );
    const safeError =
      firstValue([transaction], ['pesan_error', 'error_message', 'message']) || '';
    let notice: BlockchainDetailNotice | undefined;

    if (confirmationStatus === 'TERKONFIRMASI') {
      notice = { tone: 'success', message: 'Pencatatan sertifikat telah terkonfirmasi.' };
    } else if (confirmationStatus === 'PENDING') {
      notice = { tone: 'warning', message: 'Pencatatan sertifikat sedang diproses.' };
    } else if (confirmationStatus === 'GAGAL') {
      notice = {
        tone: 'danger',
        message: `Pencatatan sertifikat gagal${safeError ? `: ${safeError}` : '.'}`,
      };
    }

    return {
      item: {
        ...item,
        transaksi_blockchain: normalizeBlockchainTransaction(transaction, item),
      },
      notice,
    };
  }

  if (status === 'DISETUJUI') {
    return {
      item: {
        ...item,
        transaksi_blockchain: { status_konfirmasi: 'TIDAK_TERSEDIA' },
      },
      notice: {
        tone: 'warning',
        message: 'Pengajuan disetujui, tetapi status pencatatan belum tersedia.',
      },
    };
  }

  if (status === 'DITOLAK') {
    return {
      item: {
        ...item,
        transaksi_blockchain: { status_konfirmasi: 'TIDAK_DICATAT' },
      },
      notice: {
        tone: 'info',
        message: 'Pengajuan ditolak sehingga tidak dilanjutkan ke pencatatan sertifikat.',
      },
    };
  }

  return { item };
};
