import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// Layout halaman privat: sidebar kiri + area konten. Responsif:
// di ≤760px sidebar jadi baris atas (lihat prototype Dashboard.html @media).
export default function DashboardLayout() {
  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] max-md:grid-cols-1">
      <Sidebar />
      <main className="px-9 pt-[30px] pb-14 max-w-[1240px] max-md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
