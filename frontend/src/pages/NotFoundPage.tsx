import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found">
      <h1>Halaman Tidak Ditemukan</h1>
      <p>Rute yang Anda buka belum tersedia.</p>
      <Link className="primary-button" to="/">
        Kembali ke Beranda
      </Link>
    </section>
  );
}
