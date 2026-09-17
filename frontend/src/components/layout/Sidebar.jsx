import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LOGIN_PATH, NAV, roleLabel } from '../../lib/roles';

// Ikon di-port dari prototype (Dashboard.html sidebar).
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  monitoring: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-6 4 14 2-8h6" />
    </svg>
  ),
  kontrol: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  health: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2 5 3-11 2 7 1.5-3H21" />
      <path d="M20.8 8.6A5 5 0 0 0 12 6a5 5 0 0 0-8.8 2.6" />
    </svg>
  ),
  members: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l4 4v16H6z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6M9 17h4" />
      <circle cx="9.5" cy="9" r="0.5" fill="currentColor" />
    </svg>
  ),
  rekap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3" />
      <path d="M18 15v6M15 18l3 3 3-3" />
    </svg>
  ),
  konten: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 14h3M8 17h6" />
    </svg>
  ),
};

function inisial(nama) {
  if (!nama) return 'AM';
  return nama.slice(0, 2).toUpperCase();
}

// onNavigate: dipanggil saat item diklik (menutup drawer di mobile).
// onClose: bila diisi, tampilkan tombol tutup (X) di header (mode drawer).
export default function Sidebar({ onNavigate, onClose }) {
  const { username, role, logout } = useAuth();
  const navigate = useNavigate();
  const menu = NAV[role] || [];

  function handleLogout() {
    logout();
    onNavigate?.();
    navigate(LOGIN_PATH, { replace: true });
  }

  const linkClass = ({ isActive }) =>
    [
      'relative flex items-center gap-3 px-3 py-[11px] rounded-md text-[14.5px] font-medium transition-colors',
      isActive
        ? 'bg-amber-lembut text-amber-teks font-semibold'
        : 'text-tinta-60 hover:bg-permukaan-2 hover:text-tinta',
    ].join(' ');

  return (
    <aside className="flex flex-col h-full bg-permukaan border-r border-border">
      <div className="flex items-center gap-[10px] px-6 pt-6 pb-5">
        <span className="font-heading font-semibold text-[23px] leading-none">
          AMOR<span className="text-amber">.</span>
        </span>
        <span className="ml-auto text-[10.5px] tracking-[.08em] uppercase text-tinta-40 border border-border rounded-full px-2 py-[3px]">
          v1.0
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="text-tinta-40 grid place-items-center p-[6px] rounded-lg hover:bg-permukaan-2 hover:text-tinta transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-[3px] px-[14px] py-2">
        <span className="text-[10.5px] tracking-[.12em] uppercase text-tinta-40 font-semibold px-[10px] pt-[14px] pb-[6px]">
          Menu {roleLabel(role)}
        </span>
        {menu.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => onNavigate?.()} className={linkClass}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-[14px] top-[9px] bottom-[9px] w-[3px] rounded-r-[3px] bg-amber-tombol" />
                )}
                <span className="w-[19px] h-[19px] [&>svg]:w-full [&>svg]:h-full [&>svg]:stroke-[1.7]">
                  {icons[item.icon]}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-border px-[18px] py-4 flex items-center gap-[11px]">
        <div className="w-9 h-9 rounded-full bg-olive text-white grid place-items-center text-[13px] font-semibold flex-none">
          {inisial(username)}
        </div>
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold truncate">{username || 'Pengguna'}</b>
          <span className="text-[12px] text-tinta-40">{roleLabel(role)}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Keluar"
          title="Keluar"
          className="ml-auto text-tinta-40 grid place-items-center p-[6px] rounded-lg hover:text-critical-teks hover:bg-critical-bg transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-[17px] h-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
