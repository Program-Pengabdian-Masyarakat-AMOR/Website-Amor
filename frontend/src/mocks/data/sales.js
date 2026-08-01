// oil_sales: id, tanggal, jumlah_liter, harga_per_liter, total_harga, pembeli, created_at
// Rumus: total_harga = jumlah_liter * harga_per_liter
function row(id, tanggal, liter, harga, pembeli) {
  return {
    id,
    tanggal,
    jumlah_liter: liter,
    harga_per_liter: harga,
    total_harga: Math.round(liter * harga),
    pembeli,
    created_at: `${tanggal}T13:00:00.000Z`,
  };
}

// Catatan penjualan April–Juni 2026 (Reaktor AMOR).
export const oilSales = [
  // Juni 2026
  row(1, '2026-06-13', 14.0, 6500, 'Koperasi Tani Makmur'),
  row(2, '2026-06-12', 20.0, 6000, 'Pengepul Pak Hadi'),
  row(3, '2026-06-11', 18.0, 6500, 'Bengkel Las Jaya'),
  row(4, '2026-06-09', 9.6, 6000, 'Warga RW 04'),
  row(5, '2026-06-07', 22.0, 5500, 'Pengepul Pak Hadi'),
  row(6, '2026-06-05', 16.4, 6000, 'Bengkel Las Jaya'),
  row(7, '2026-06-03', 12.0, 6000, 'Koperasi Tani Makmur'),
  row(8, '2026-06-02', 16.0, 5700, 'Pengepul Pak Hadi'),
  // Mei 2026
  row(9, '2026-05-28', 16.0, 6000, 'Pengepul Pak Hadi'),
  row(10, '2026-05-24', 20.0, 6500, 'Bengkel Las Jaya'),
  row(11, '2026-05-18', 30.0, 5500, 'Koperasi Tani Makmur'),
  row(12, '2026-05-12', 24.0, 6000, 'Pengepul Pak Hadi'),
  row(13, '2026-05-05', 34.0, 6000, 'Bengkel Las Jaya'),
  // April 2026
  row(14, '2026-04-26', 18.0, 6000, 'Pengepul Pak Hadi'),
  row(15, '2026-04-20', 22.0, 5500, 'Koperasi Tani Makmur'),
  row(16, '2026-04-14', 28.0, 6000, 'Bengkel Las Jaya'),
  row(17, '2026-04-08', 30.0, 6000, 'Pengepul Pak Hadi'),
  row(18, '2026-04-03', 20.0, 6500, 'Bengkel Las Jaya'),
];
