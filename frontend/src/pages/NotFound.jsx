import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <div className="font-heading font-semibold text-[64px] leading-none text-amber">404</div>
        <h1 className="mt-3 text-[24px]">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-tinta-60">Sepertinya tautan yang dituju tidak tersedia.</p>
        <Link to="/" className="btn btn-primary mt-6 px-5 py-[10px]">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
