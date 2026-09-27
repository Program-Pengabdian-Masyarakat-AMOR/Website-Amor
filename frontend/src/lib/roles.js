// Definisi role + menu dashboard per role. Satu sumber kebenaran untuk
// form login, Sidebar, dan penjaga route (App.jsx).

// URL login sengaja disamarkan (tidak ditautkan dari halaman publik).
export const LOGIN_PATH = '/administrator/login';

export const ROLE_META = {
  admin: {
    label: 'Admin',
    desc: 'Monitoring sistem, health check & rekap data',
  },
  operator: {
    label: 'Operator',
    desc: 'Operasional mesin, monitoring live & kontrol',
  },
  management: {
    label: 'Management',
    desc: 'Penjualan & data yang tampil di publik',
  },
};

export const ROLES = Object.keys(ROLE_META);

// Menu per role. `to` relatif ke /dashboard; path yang sama boleh muncul di lebih dari
// satu role hanya bila memang halaman bersama (saat ini tidak ada — tiap role punya section sendiri).
export const NAV = {
  admin: [
    { to: '/dashboard', label: 'Status Sistem', icon: 'dashboard', end: true },
    { to: '/dashboard/health', label: 'Health Check', icon: 'health' },
    { to: '/dashboard/rekap', label: 'Data & Rekap', icon: 'rekap' },
    { to: '/dashboard/members', label: 'Anggota', icon: 'members' },
  ],
  operator: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/dashboard/monitoring', label: 'Monitoring & Log', icon: 'monitoring' },
    { to: '/dashboard/kontrol', label: 'Kontrol', icon: 'kontrol' },
  ],
  management: [
    { to: '/dashboard', label: 'Dashboard Penjualan', icon: 'dashboard', end: true },
    { to: '/dashboard/sales', label: 'Penjualan', icon: 'sales' },
    { to: '/dashboard/konten', label: 'Data Publik', icon: 'konten' },
  ],
};

export const roleLabel = (role) => ROLE_META[role]?.label || role || 'Pengguna';
