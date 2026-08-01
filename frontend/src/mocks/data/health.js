// health_status: id, session_id, status (normal|warning|critical), keterangan, created_at
// session_id selaras dengan production.js. Urut terbaru → terlama (dipakai "Alert terbaru").
export const healthStatus = [
  {
    id: 5,
    session_id: 'SES-128',
    status: 'normal',
    keterangan: 'Suhu pirolisis & tungku berada di pita target, gas tidak terdeteksi.',
    created_at: '2026-06-13T03:41:00.000Z',
  },
  {
    id: 4,
    session_id: 'SES-128',
    status: 'warning',
    keterangan: 'Suhu tungku sempat di bawah target saat pemanasan awal — pembakaran belum optimal.',
    created_at: '2026-06-13T02:00:00.000Z',
  },
  {
    id: 3,
    session_id: 'SES-128',
    status: 'warning',
    keterangan: 'Gas sempat terdeteksi di awal proses sebelum suhu mencapai target.',
    created_at: '2026-06-13T01:38:00.000Z',
  },
  {
    id: 2,
    session_id: 'SES-125',
    status: 'critical',
    keterangan: 'Suhu pirolisis & tungku jauh di bawah target dan gas terdeteksi — sesi dihentikan.',
    created_at: '2026-06-10T03:46:00.000Z',
  },
  {
    id: 1,
    session_id: 'SES-127',
    status: 'normal',
    keterangan: 'Seluruh parameter dalam batas aman sepanjang sesi.',
    created_at: '2026-06-12T03:35:00.000Z',
  },
];
