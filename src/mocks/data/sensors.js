// Telemetri IoT → Web (via Firebase, direlay backend). Bentuk objek:
//   suhu_pirolisis, suhu_tungku : number (°C)
//   berat_sampah, berat_minyak, berat_sampah_total : number (kg)
//   status_gas : boolean (true = terdeteksi)
//   status_sistem : "idle" | "running"
export const sensorLatest = {
  timestamp: '2026-06-13T03:42:00.000Z',
  suhu_pirolisis: 402,
  suhu_tungku: 806,
  berat_sampah: 3.0,
  berat_minyak: 9.7,
  berat_sampah_total: 15.2,
  status_gas: false,
  status_sistem: 'running',
};

// Tren selama sesi berjalan (suhu naik ke target, berat sampah menyusut,
// minyak bertambah). Dipakai grafik Monitoring.
const mulai = Date.UTC(2026, 5, 13, 1, 28);
const trace = [
  { menit: 0, pir: 90, tun: 180, sampah: 15.2, minyak: 0.0, gas: true },
  { menit: 10, pir: 210, tun: 420, sampah: 14.4, minyak: 0.6, gas: true },
  { menit: 20, pir: 320, tun: 640, sampah: 12.6, minyak: 2.1, gas: false },
  { menit: 30, pir: 372, tun: 742, sampah: 10.2, minyak: 3.8, gas: false },
  { menit: 40, pir: 396, tun: 790, sampah: 7.8, minyak: 5.6, gas: false },
  { menit: 50, pir: 404, tun: 808, sampah: 5.4, minyak: 7.4, gas: false },
  { menit: 60, pir: 401, tun: 803, sampah: 3.9, minyak: 8.9, gas: false },
  { menit: 72, pir: 402, tun: 806, sampah: 3.0, minyak: 9.7, gas: false },
];

export const sensorSeries = trace.map((t) => ({
  timestamp: new Date(mulai + t.menit * 60000).toISOString(),
  suhu_pirolisis: t.pir,
  suhu_tungku: t.tun,
  berat_sampah: t.sampah,
  berat_minyak: t.minyak,
  berat_sampah_total: 15.2,
  status_gas: t.gas,
  status_sistem: 'running',
}));
