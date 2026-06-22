// production_logs: id, session_id, berat_input_total, berat_output_minyak,
//   yield_percent, suhu_avg, suhu_max, durasi_menit, created_at
// Rumus: yield_percent = (berat_output_minyak / berat_input_total) * 100
function y(input, output) {
  return Number(((output / input) * 100).toFixed(1));
}

// 8 sesi terakhir (#121 terlama → #128 terbaru). session_id dipakai bersama oleh
// health_status & predictions agar bisa di-join (lihat data/health.js, data/predictions.js).
export const productionLogs = [
  { id: 8, session_id: 'SES-128', berat_input_total: 15.2, berat_output_minyak: 9.7, yield_percent: y(15.2, 9.7), suhu_avg: 388, suhu_max: 431, durasi_menit: 72, created_at: '2026-06-13T01:28:00.000Z' },
  { id: 7, session_id: 'SES-127', berat_input_total: 16.0, berat_output_minyak: 10.8, yield_percent: y(16.0, 10.8), suhu_avg: 392, suhu_max: 409, durasi_menit: 84, created_at: '2026-06-12T02:10:00.000Z' },
  { id: 6, session_id: 'SES-126', berat_input_total: 14.5, berat_output_minyak: 10.1, yield_percent: y(14.5, 10.1), suhu_avg: 388, suhu_max: 401, durasi_menit: 79, created_at: '2026-06-11T02:40:00.000Z' },
  { id: 5, session_id: 'SES-125', berat_input_total: 15.8, berat_output_minyak: 6.2, yield_percent: y(15.8, 6.2), suhu_avg: 405, suhu_max: 433, durasi_menit: 41, created_at: '2026-06-10T03:05:00.000Z' },
  { id: 4, session_id: 'SES-124', berat_input_total: 13.9, berat_output_minyak: 9.6, yield_percent: y(13.9, 9.6), suhu_avg: 384, suhu_max: 398, durasi_menit: 76, created_at: '2026-06-09T02:15:00.000Z' },
  { id: 3, session_id: 'SES-123', berat_input_total: 15.0, berat_output_minyak: 9.5, yield_percent: y(15.0, 9.5), suhu_avg: 379, suhu_max: 396, durasi_menit: 95, created_at: '2026-06-07T02:30:00.000Z' },
  { id: 2, session_id: 'SES-122', berat_input_total: 14.2, berat_output_minyak: 9.4, yield_percent: y(14.2, 9.4), suhu_avg: 386, suhu_max: 402, durasi_menit: 78, created_at: '2026-06-06T02:00:00.000Z' },
  { id: 1, session_id: 'SES-121', berat_input_total: 15.5, berat_output_minyak: 9.5, yield_percent: y(15.5, 9.5), suhu_avg: 372, suhu_max: 390, durasi_menit: 80, created_at: '2026-06-05T02:00:00.000Z' },
];
