// Aturan health check (rule-based) — memantau suhu PIROLISIS & TUNGKU.
// SATU sumber logika dengan backend (backend/src/lib/thresholds.js).
//
// Prinsip: makin panas → pembakaran makin sempurna → gas makin minim. Suhu dinilai
// terhadap PITA target (bawah–atas) HANYA saat mesin berproses (running).
// Suhu di luar pita → warning (tidak menghentikan). Gas terdeteksi → critical.

export const DEFAULT_SETPOINTS = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
};

export function statusSuhu(nilai, band) {
  if (nilai == null || !band) return 'aman';
  if (nilai < band.bawah) return 'rendah';
  if (nilai > band.atas) return 'tinggi';
  return 'aman';
}

export function hitungAlert({ suhuPirolisis, suhuTungku, statusGas, statusSistem, setpoint = DEFAULT_SETPOINTS } = {}) {
  const alerts = [];

  if (statusGas === true) {
    alerts.push({ tipe: 'gas', severity: 'critical', pesan: 'Gas mudah terbakar terdeteksi di sekitar reaktor' });
  }

  // Suhu hanya dinilai saat mesin BERPROSES. Saat idle, suhu rendah (ruang) itu wajar.
  if (statusSistem === 'running') {
    const cek = (label, nilai, band) => {
      const st = statusSuhu(nilai, band);
      if (st === 'rendah') {
        alerts.push({ tipe: 'suhu', severity: 'warning', pesan: `Suhu ${label} ${nilai}°C di bawah target (min ${band.bawah}°C) — pembakaran belum optimal` });
      } else if (st === 'tinggi') {
        alerts.push({ tipe: 'suhu', severity: 'warning', pesan: `Suhu ${label} ${nilai}°C melewati batas atas ${band.atas}°C` });
      }
    };
    cek('pirolisis', suhuPirolisis, setpoint.pirolisis);
    cek('tungku', suhuTungku, setpoint.tungku);
  }

  return alerts;
}

export function statusDariAlert(alerts = []) {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.length) return 'warning';
  return 'normal';
}
