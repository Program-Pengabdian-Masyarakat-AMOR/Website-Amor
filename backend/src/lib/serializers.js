// Ubah baris Prisma (camelCase) → bentuk JSON kontrak FE (snake_case).
// Menjaga kompatibilitas persis dengan client/src/mocks/README.md.

export const memberDTO = (m) => ({
  id: m.id,
  nama: m.nama,
  nim_nip: m.nimNip,
  jabatan: m.jabatan,
  kontak: m.kontak,
  foto: m.foto,
  created_at: m.createdAt,
});

export const saleDTO = (s) => ({
  id: s.id,
  tanggal: s.tanggal,
  jumlah_liter: s.jumlahLiter,
  harga_per_liter: s.hargaPerLiter,
  total_harga: s.totalHarga,
  pembeli: s.pembeli,
  created_at: s.createdAt,
});

export const productionDTO = (p) => ({
  id: p.id,
  session_id: p.sessionId,
  berat_sampah_total: p.beratSampahTotal,
  berat_minyak_total: p.beratMinyakTotal,
  yield_percent: p.yieldPercent,
  waktu_proses_ms: p.waktuProsesDetik, // kolom menyimpan MILIDETIK (dari IoT)
  suhu_pirolisis_avg: p.suhuPirolisisAvg,
  suhu_tungku_avg: p.suhuTungkuAvg,
  created_at: p.createdAt,
});

export const healthDTO = (h) => ({
  id: h.id,
  session_id: h.sessionId,
  status: h.status,
  keterangan: h.keterangan,
  created_at: h.createdAt,
});

export const predictionDTO = (p) => ({
  id: p.id,
  session_id: p.sessionId,
  predicted_yield: p.predictedYield,
  actual_yield: p.actualYield,
});

export const feederMovementDTO = (m) => ({
  id: m.id,
  action: m.action,
  source: m.source,
  reason: m.reason,
  suhu_pirolisis: m.suhuPirolisis,
  suhu_tungku: m.suhuTungku,
  berat_sampah: m.beratSampah,
  ai_score: m.aiScore,
  created_at: m.createdAt,
});
