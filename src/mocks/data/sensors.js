// sensor_logs: id, device_id, timestamp, berat_input, suhu_reaktor, gas_level,
//              status_proses (running|idle|finished)
export const sensorLatest = {
  id: 's-latest',
  device_id: 'ESP32-RW04-01',
  timestamp: '2026-06-13T03:42:00.000Z',
  berat_input: 3.0,
  suhu_reaktor: 408,
  gas_level: 540,
  status_proses: 'running',
};

// Tren selama sesi #128 (suhu naik, berat menyusut) untuk grafik Monitoring.
// Bentuk tiap titik = sensor_logs; menit dihitung dari timestamp mulai.
const mulai = Date.UTC(2026, 5, 13, 1, 28);
const trace = [
  { menit: 0, suhu: 60, berat: 15.2, gas: 90 },
  { menit: 10, suhu: 150, berat: 14.4, gas: 110 },
  { menit: 20, suhu: 250, berat: 12.6, gas: 140 },
  { menit: 30, suhu: 322, berat: 10.2, gas: 160 },
  { menit: 40, suhu: 360, berat: 7.8, gas: 175 },
  { menit: 50, suhu: 378, berat: 5.4, gas: 180 },
  { menit: 60, suhu: 384, berat: 3.9, gas: 182 },
  { menit: 72, suhu: 388, berat: 3.0, gas: 182 },
];

export const sensorSeries = trace.map((t, i) => ({
  id: `s-${i}`,
  device_id: 'ESP32-RW04-01',
  timestamp: new Date(mulai + t.menit * 60000).toISOString(),
  berat_input: t.berat,
  suhu_reaktor: t.suhu,
  gas_level: t.gas,
  status_proses: 'running',
}));
