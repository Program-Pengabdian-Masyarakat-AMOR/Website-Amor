import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// Layout privat: sidebar tetap di desktop (≥768px), drawer geser di mobile.
export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  // Kunci scroll body + tutup dengan Esc saat drawer terbuka.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar desktop */}
      <div className="hidden md:block sticky top-0 h-screen">
        <Sidebar />
      </div>

      {/* Top bar mobile */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 bg-permukaan border-b border-border px-4 h-14">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="grid place-items-center w-9 h-9 -ml-1 rounded-lg text-tinta hover:bg-permukaan-2 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="font-heading font-semibold text-[20px] leading-none">
          AMOR<span className="text-amber">.</span>
        </span>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-tinta/[.42] backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] max-w-[84%] shadow-2 animate-[amor-drawer_.22s_ease]">
            <Sidebar onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="w-full max-w-[1240px] px-9 pt-[30px] pb-14 max-md:px-4 max-md:pt-5 max-md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}
