// Aturan health check (rule-based) — selaras kontrak IoT (Firebase).
// Logika final ada di backend; mock & UI memakai aturan yang sama.
//
// Prinsip proses: makin panas → pembakaran makin sempurna → gas makin minim.
// Jadi RISIKO gas justru saat suhu TERLALU RENDAH, sementara suhu TERLALU TINGGI
// berisiko overheat. Suhu dinilai terhadap PITA target (bawah–atas) dari halaman Kontrol.
//
// Severity:
//   - Suhu di luar pita (rendah/tinggi) → 'warning' saja (CUKUP alert, proses TIDAK dihentikan).
//   - Gas terdeteksi → 'critical' (bahaya nyata).

// Setpoint default (bisa dikalibrasi). Target baik: tungku ~800°C, pirolisis ~400°C.
export const DEFAULT_SETPOINTS = {
  pirolisis: { bawah: 380, atas: 420 },
  tungku: { bawah: 780, atas: 820 },
};

/** Posisi satu nilai suhu terhadap pita target. */
export function statusSuhu(nilai, band) {
  if (nilai == null || !band) return 'aman';
  if (nilai < band.bawah) return 'rendah';
  if (nilai > band.atas) return 'tinggi';
  return 'aman';
}

/**
 * Daftar alert dari telemetri terkini.
 * @returns {{tipe:string, severity:'warning'|'critical', pesan:string}[]}
 */
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

/**
 * Status keseluruhan dari daftar alert.
 * Suhu (warning) TIDAK pernah menjadikan critical — hanya gas yang critical.
 */
export function statusDariAlert(alerts = []) {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.length) return 'warning';
  return 'normal';
}
