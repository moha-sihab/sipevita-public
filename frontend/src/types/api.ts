export type UserRole = 'PPAT' | 'ATR_BPN';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

export interface User {
  id_pengguna: number;
  username: string;
  peran: UserRole;
  nama_lengkap?: string;
  status_aktif?: boolean;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Pengajuan {
  id?: number;
  id_pengajuan?: number;
  id_notaris?: number;
  id_reviewer?: number | null;
  nomor_sertifikat?: string;
  nib?: string;
  lokasi_tanah?: string;
  luas_tanah?: number | string;
  jenis_hak?: string;
  keterangan?: string | null;
  nomor_akta?: string;
  tanggal_akta?: string;
  jenis_transaksi?: string;
  status?: string;
  status_pengajuan?: string;
  created_at?: string;
  updated_at?: string;
  tanggal_pengajuan?: string;
  catatan_reviewer?: string | null;
  data_sertifikat?: Record<string, unknown>;
  pengguna?: User;
  pihak_transaksi?: Array<Record<string, unknown>>;
  dokumen?: Array<Record<string, unknown>>;
  transaksi_blockchain?: Record<string, unknown> | null;
}

export interface BlockchainDetailNotice {
  message: string;
  tone: 'info' | 'warning' | 'danger' | 'success';
}

export interface BlockchainHistoryItem {
  timestamp?: string;
  txId?: string;
  tx_id?: string;
  transaction_id?: string;
  hash_transaksi?: string;
  id_blok?: string | number;
  block_number?: string | number;
  isDelete?: boolean;
  is_delete?: boolean;
  nomor_sertifikat?: string;
  lokasi_tanah?: string;
  luas_tanah?: number | string;
  status?: string;
  nama_pemilik?: string | null;
  peran_pemilik?: string | null;
  status_pengajuan?: string;
  jenis_transaksi?: string;
  tanggal_pengajuan?: string;
  timestamp_blockchain?: string;
  value?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BlockchainHistoryResponse {
  items: BlockchainHistoryItem[];
  count: number;
}

export interface ListResponse<T> {
  items: T[];
  count: number;
  page?: number;
  limit?: number;
  total?: number;
}

export type DokumenStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED' | 'SUPERSEDED';

export interface PengajuanDokumenRow {
  id_dokumen: string | number;
  id_pengajuan?: number;
  nama_file?: string | null;
  hash_file?: string | null;
  cid_ipfs?: string | null;
  tanggal_unggah?: string | null;
  jenis_dokumen?: string | null;
  status_upload?: DokumenStatus | null;
  nama_file_asli?: string | null;
  mime_type?: string | null;
  ukuran_file?: number | null;
  tanggal_upload?: string | null;
  is_active?: boolean;
}

export interface UploadedDocumentResult {
  idDokumen: string | number;
  jenisDokumen: string;
  namaFile: string;
  mimeType: string;
  ukuranFile: number;
  cid: string;
  sha256: string;
  statusUpload: string;
}

export interface UploadDocumentResult {
  idPengajuan: number;
  manifestCid: string;
  documents: UploadedDocumentResult[];
}

export interface Dokumen {
  idDokumen: string | number;
  idPengajuan: number;
  jenisDokumen: string | null;
  namaFileAsli: string | null;
  mimeType: string | null;
  ukuranFile: number | null;
  statusUpload: DokumenStatus;
  tanggalUpload: string | null;
  isActive: boolean;
}

export interface SignedDownloadLink {
  idDokumen: string | number;
  namaFile: string | null;
  mimeType: string | null;
  expiresIn: number;
  downloadUrl: string;
}

export interface SignedPreviewLink {
  idDokumen: string | number;
  namaFile: string | null;
  mimeType: string | null;
  expiresIn: number;
  previewUrl: string;
}
