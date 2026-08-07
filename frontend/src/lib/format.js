// Helper format angka & tanggal — locale id-ID (lihat docs/CLAUDE.md → Konvensi kode).

const nfDefault = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const nfCurrency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Angka biasa, mis. 1.234,5 */
export function formatAngka(value, opts) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (opts) return new Intl.NumberFormat('id-ID', opts).format(Number(value));
  return nfDefault.format(Number(value));
}

/** Rupiah, mis. Rp1.250.000 */
export function formatRupiah(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return nfCurrency.format(Number(value));
}

/** Persen, mis. 62,5% */
export function formatPersen(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}

/** Tanggal panjang, mis. Senin, 13 Jun 2026 */
export function formatTanggal(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Durasi dari MILIDETIK → menit (dibulatkan), mis. 4320000 → "72 mnt" */
export function formatDurasiMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const menit = Math.round(Number(ms) / 60000);
  return `${menit.toLocaleString('id-ID')} mnt`;
}

/** Milidetik → menit sebagai angka (untuk perhitungan). */
export function menitDariMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return 0;
  return Math.round(Number(ms) / 60000);
}

/** Milidetik → "MM:SS" (untuk timer proses berjalan). */
export function formatMmSs(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Jam:menit WIB, mis. 10:42 */
export function formatJam(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
