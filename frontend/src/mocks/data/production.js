// production_logs (hasil_akhir per sesi). Field mentah dari IoT: berat_minyak_total,
// berat_sampah_total, waktu_proses (detik). Field turunan/olahan backend: session_id,
// yield_percent, suhu_pirolisis_avg, suhu_tungku_avg, created_at.
// Rumus: yield_percent = (berat_minyak_total / berat_sampah_total) * 100
// waktu_proses_detik = detik (UI menampilkannya sebagai menit).
function y(input, output) {
  return Number(((output / input) * 100).toFixed(1));
}

export const productionLogs = [
  { id: 8, session_id: 'SES-128', berat_sampah_total: 15.2, berat_minyak_total: 9.7, yield_percent: y(15.2, 9.7), waktu_proses_detik: 4320, suhu_pirolisis_avg: 402, suhu_tungku_avg: 806, created_at: '2026-06-13T01:28:00.000Z' },
  { id: 7, session_id: 'SES-127', berat_sampah_total: 16.0, berat_minyak_total: 10.8, yield_percent: y(16.0, 10.8), waktu_proses_detik: 5040, suhu_pirolisis_avg: 398, suhu_tungku_avg: 795, created_at: '2026-06-12T02:10:00.000Z' },
  { id: 6, session_id: 'SES-126', berat_sampah_total: 14.5, berat_minyak_total: 10.1, yield_percent: y(14.5, 10.1), waktu_proses_detik: 4740, suhu_pirolisis_avg: 405, suhu_tungku_avg: 810, created_at: '2026-06-11T02:40:00.000Z' },
  { id: 5, session_id: 'SES-125', berat_sampah_total: 15.8, berat_minyak_total: 6.2, yield_percent: y(15.8, 6.2), waktu_proses_detik: 2460, suhu_pirolisis_avg: 356, suhu_tungku_avg: 705, created_at: '2026-06-10T03:05:00.000Z' },
  { id: 4, session_id: 'SES-124', berat_sampah_total: 13.9, berat_minyak_total: 9.6, yield_percent: y(13.9, 9.6), waktu_proses_detik: 4560, suhu_pirolisis_avg: 400, suhu_tungku_avg: 800, created_at: '2026-06-09T02:15:00.000Z' },
  { id: 3, session_id: 'SES-123', berat_sampah_total: 15.0, berat_minyak_total: 9.5, yield_percent: y(15.0, 9.5), waktu_proses_detik: 5700, suhu_pirolisis_avg: 392, suhu_tungku_avg: 788, created_at: '2026-06-07T02:30:00.000Z' },
  { id: 2, session_id: 'SES-122', berat_sampah_total: 14.2, berat_minyak_total: 9.4, yield_percent: y(14.2, 9.4), waktu_proses_detik: 4680, suhu_pirolisis_avg: 403, suhu_tungku_avg: 805, created_at: '2026-06-06T02:00:00.000Z' },
  { id: 1, session_id: 'SES-121', berat_sampah_total: 15.5, berat_minyak_total: 9.5, yield_percent: y(15.5, 9.5), waktu_proses_detik: 4800, suhu_pirolisis_avg: 388, suhu_tungku_avg: 782, created_at: '2026-06-05T02:00:00.000Z' },
];
