// Ambang health check (rule-based) — lihat docs/CLAUDE.md → Health check.
// Disimpan terpusat agar gampang dikalibrasi. Logika final ada di backend FASE 2;
// mock & UI memakai aturan yang sama.

export const THRESHOLDS = {
  suhuMaxAman: 420, // °C — di atas ini dianggap pelanggaran
  gasLevelAman: 400, // ppm — gas terdeteksi bila melewati ini
  durasiMin: 45, // menit — proses tak normal bila terlalu cepat
  durasiMaks: 240, // menit — atau terlalu lama
  yieldMin: 35, // % — yield di bawah ambang dianggap pelanggaran
};

/**
 * Hitung daftar pelanggaran dari satu sesi/pembacaan.
 * @returns {string[]} keterangan tiap pelanggaran
 */
export function hitungPelanggaran({ suhu, gas, durasi, yield: yieldVal } = {}) {
  const pelanggaran = [];
  if (suhu != null && suhu > THRESHOLDS.suhuMaxAman) {
    pelanggaran.push(`Suhu reaktor ${suhu}°C melewati batas aman ${THRESHOLDS.suhuMaxAman}°C`);
  }
  if (gas != null && gas > THRESHOLDS.gasLevelAman) {
    pelanggaran.push(`Gas terdeteksi pada level ${gas} ppm`);
  }
  if (durasi != null && (durasi < THRESHOLDS.durasiMin || durasi > THRESHOLDS.durasiMaks)) {
    pelanggaran.push(`Durasi proses ${durasi} menit di luar rentang normal`);
  }
  if (yieldVal != null && yieldVal < THRESHOLDS.yieldMin) {
    pelanggaran.push(`Yield ${yieldVal}% di bawah ambang ${THRESHOLDS.yieldMin}%`);
  }
  return pelanggaran;
}

/** 0 → normal · 1 → warning · ≥2 → critical */
export function statusDariPelanggaran(jumlah) {
  if (jumlah <= 0) return 'normal';
  if (jumlah === 1) return 'warning';
  return 'critical';
}
