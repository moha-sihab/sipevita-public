import type { BlockchainHistoryItem, BlockchainHistoryResponse } from '../types/api';

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeHistoryItem = (item: unknown): BlockchainHistoryItem => {
  const record = asRecord(item) as BlockchainHistoryItem;
  const value = asRecord(record.value);
  const hasLedgerValue = Object.keys(value).length > 0;

  if (hasLedgerValue) {
    return {
      ...record,
      txId: record.txId || record.tx_id || record.transaction_id,
      isDelete: record.isDelete ?? record.is_delete,
      block_number: record.block_number ?? record.id_blok,
      value,
    };
  }

  const publicValue = {
    nomor_sertifikat: record.nomor_sertifikat,
    lokasi_tanah: record.lokasi_tanah,
    luas_tanah: record.luas_tanah,
    status: record.status,
    jenis_transaksi: record.jenis_transaksi,
    created_at: record.tanggal_pengajuan,
    updated_at: record.timestamp_blockchain || record.tanggal_pengajuan,
  };

  return {
    ...record,
    txId: record.txId || record.tx_id || record.transaction_id || record.hash_transaksi,
    timestamp: record.timestamp || record.timestamp_blockchain || record.tanggal_pengajuan,
    isDelete: record.isDelete ?? record.is_delete,
    block_number: record.block_number ?? record.id_blok,
    value: publicValue,
  };
};

export const normalizeHistoryResponse = (value: unknown): BlockchainHistoryResponse => {
  if (Array.isArray(value)) {
    return { items: value.map(normalizeHistoryItem), count: value.length };
  }

  const response = asRecord(value);
  const sourceItems = Array.isArray(response.history)
    ? response.history
    : Array.isArray(response.items)
      ? response.items
      : [];
  const items = Array.isArray(sourceItems)
    ? sourceItems.map(normalizeHistoryItem)
    : [];
  const count = Number(response.total ?? response.count);

  return {
    items,
    count: Number.isFinite(count) ? count : items.length,
  };
};

export const displayValue = (value: unknown, fallback = '-') =>
  value === undefined || value === null || value === '' ? fallback : String(value);

export const getHistoryValue = (item: BlockchainHistoryItem) => {
  const nestedValue = asRecord(item.value);
  return Object.keys(nestedValue).length > 0 ? nestedValue : asRecord(item);
};

export const getHistoryTxId = (item: BlockchainHistoryItem) =>
  item.txId || item.tx_id || item.transaction_id || item.hash_transaksi;

export const isHistoryDelete = (item: BlockchainHistoryItem) =>
  Boolean(item.isDelete ?? item.is_delete);

export const maskHash = (value: unknown, masked: boolean) => {
  const text = displayValue(value);
  if (!masked || text === '-' || text.length <= 14) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
};
