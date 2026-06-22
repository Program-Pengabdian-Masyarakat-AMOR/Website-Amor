// health_status: id, session_id, status (normal|warning|critical), keterangan, created_at
// session_id selaras dengan production.js. Urut terbaru → terlama (dipakai "Alert terbaru").
export const healthStatus = [
  {
    id: 5,
    session_id: 'SES-128',
    status: 'critical',
    keterangan: 'Suhu reaktor menyentuh 431 °C, melebihi ambang aman 420 °C.',
    created_at: '2026-06-13T03:41:00.000Z',
  },
  {
    id: 4,
    session_id: 'SES-128',
    status: 'warning',
    keterangan: 'Tekanan naik mendekati batas; pantau hingga sesi selesai.',
    created_at: '2026-06-13T03:33:00.000Z',
  },
  {
    id: 3,
    session_id: 'SES-128',
    status: 'normal',
    keterangan: 'Sesi produksi #128 dimulai dengan normal.',
    created_at: '2026-06-13T01:28:00.000Z',
  },
  {
    id: 2,
    session_id: 'SES-125',
    status: 'critical',
    keterangan: 'Yield 39,2% rendah & durasi proses terlalu singkat — sesi dihentikan.',
    created_at: '2026-06-10T03:46:00.000Z',
  },
  {
    id: 1,
    session_id: 'SES-127',
    status: 'normal',
    keterangan: 'Semua parameter dalam batas aman.',
    created_at: '2026-06-12T03:35:00.000Z',
  },
];
