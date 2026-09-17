// Helper periode tanggal (string YYYY-MM-DD, zona waktu browser).
// Dipakai halaman penjualan & rekap supaya periode tidak pernah ditulis mati per bulan.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const pad = (n) => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD" (tanggal lokal, bukan UTC). */
export function keTanggal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function tanggalHariIni() {
  return keTanggal(new Date());
}

/** Tanggal n hari sebelum hari ini. */
export function tanggalMundur(hari) {
  const d = new Date();
  d.setDate(d.getDate() - hari);
  return keTanggal(d);
}

/**
 * Rentang untuk (tahun, bulan). bulan = 1–12, atau 'all' untuk setahun penuh.
 * → { dari, sampai, prefix } — prefix cocok untuk filter `tanggal.startsWith(prefix)`.
 */
export function rentangPeriode(tahun, bulan) {
  if (bulan === 'all') {
    return { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31`, prefix: `${tahun}-` };
  }
  const hariTerakhir = new Date(tahun, bulan, 0).getDate();
  return {
    dari: `${tahun}-${pad(bulan)}-01`,
    sampai: `${tahun}-${pad(bulan)}-${pad(hariTerakhir)}`,
    prefix: `${tahun}-${pad(bulan)}`,
  };
}

export function labelPeriode(tahun, bulan) {
  return bulan === 'all' ? `Tahun ${tahun}` : `${MONTHS_FULL[bulan - 1]} ${tahun}`;
}
