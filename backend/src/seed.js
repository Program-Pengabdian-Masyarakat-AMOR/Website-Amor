import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const y = (input, output) => Number(((output / input) * 100).toFixed(1));

async function main() {
  console.log('[seed] mulai…');

  // --- Users ---
  const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'operator_rw04', password: 'operator123', role: 'operator' },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash, role: u.role },
      create: { username: u.username, passwordHash, role: u.role },
    });
  }

  // --- Members ---
  await prisma.member.deleteMany();
  await prisma.member.createMany({
    data: [
      { nama: 'Dr. Bayu Hermawan', nimNip: '198504112011011', jabatan: 'Ketua', kontak: '0812-3456-7001' },
      { nama: 'Putri Anggraini', nimNip: '2021110045', jabatan: 'Anggota', kontak: 'putri.a@kampus.ac.id' },
      { nama: 'Rizki Pratama', nimNip: '2021110052', jabatan: 'Anggota', kontak: '0813-2299-4410' },
      { nama: 'Slamet Widodo', nimNip: 'WRG-04-007', jabatan: 'Operator', kontak: '0856-7788-1200' },
      { nama: 'Nur Aini', nimNip: '2022110118', jabatan: 'Anggota', kontak: 'nur.aini@kampus.ac.id' },
      { nama: 'Eko Saputra', nimNip: 'WRG-04-011', jabatan: 'Operator', kontak: '0857-0099-3321' },
    ],
  });

  // --- Sales (April–Juni 2026) ---
  const sRows = [
    ['2026-06-13', 14.0, 6500, 'Koperasi Tani Makmur'],
    ['2026-06-12', 20.0, 6000, 'Pengepul Pak Hadi'],
    ['2026-06-11', 18.0, 6500, 'Bengkel Las Jaya'],
    ['2026-06-09', 9.6, 6000, 'Warga RW 04'],
    ['2026-06-07', 22.0, 5500, 'Pengepul Pak Hadi'],
    ['2026-06-05', 16.4, 6000, 'Bengkel Las Jaya'],
    ['2026-06-03', 12.0, 6000, 'Koperasi Tani Makmur'],
    ['2026-06-02', 16.0, 5700, 'Pengepul Pak Hadi'],
    ['2026-05-28', 16.0, 6000, 'Pengepul Pak Hadi'],
    ['2026-05-24', 20.0, 6500, 'Bengkel Las Jaya'],
    ['2026-05-18', 30.0, 5500, 'Koperasi Tani Makmur'],
    ['2026-05-12', 24.0, 6000, 'Pengepul Pak Hadi'],
    ['2026-05-05', 34.0, 6000, 'Bengkel Las Jaya'],
    ['2026-04-26', 18.0, 6000, 'Pengepul Pak Hadi'],
    ['2026-04-20', 22.0, 5500, 'Koperasi Tani Makmur'],
    ['2026-04-14', 28.0, 6000, 'Bengkel Las Jaya'],
    ['2026-04-08', 30.0, 6000, 'Pengepul Pak Hadi'],
    ['2026-04-03', 20.0, 6500, 'Bengkel Las Jaya'],
  ];
  await prisma.sale.deleteMany();
  await prisma.sale.createMany({
    data: sRows.map(([tanggal, jumlahLiter, hargaPerLiter, pembeli]) => ({
      tanggal,
      jumlahLiter,
      hargaPerLiter,
      totalHarga: Math.round(jumlahLiter * hargaPerLiter),
      pembeli,
    })),
  });

  // --- Production logs (#121–#128) ---
  const pRows = [
    ['SES-121', 15.5, 9.5, 4800, 388, 782],
    ['SES-122', 14.2, 9.4, 4680, 403, 805],
    ['SES-123', 15.0, 9.5, 5700, 392, 788],
    ['SES-124', 13.9, 9.6, 4560, 400, 800],
    ['SES-125', 15.8, 6.2, 2460, 356, 705],
    ['SES-126', 14.5, 10.1, 4740, 405, 810],
    ['SES-127', 16.0, 10.8, 5040, 398, 795],
    ['SES-128', 15.2, 9.7, 4320, 402, 806],
  ];
  await prisma.productionLog.deleteMany();
  await prisma.productionLog.createMany({
    data: pRows.map(([sessionId, sampah, minyak, waktu, pir, tun]) => ({
      sessionId,
      beratSampahTotal: sampah,
      beratMinyakTotal: minyak,
      yieldPercent: y(sampah, minyak),
      waktuProsesDetik: waktu,
      suhuPirolisisAvg: pir,
      suhuTungkuAvg: tun,
    })),
  });

  // --- Health history ---
  await prisma.healthStatus.deleteMany();
  await prisma.healthStatus.createMany({
    data: [
      { sessionId: 'SES-127', status: 'normal', keterangan: 'Seluruh parameter dalam batas aman sepanjang sesi.' },
      { sessionId: 'SES-125', status: 'critical', keterangan: 'Suhu pirolisis & tungku jauh di bawah target dan gas terdeteksi — sesi dihentikan.' },
      { sessionId: 'SES-128', status: 'normal', keterangan: 'Suhu pirolisis & tungku di pita target, gas tidak terdeteksi.' },
    ],
  });

  // --- Predictions (predictedYield menunggu ONNX) ---
  await prisma.prediction.deleteMany();
  await prisma.prediction.createMany({
    data: [
      { sessionId: 'SES-124', predictedYield: null, actualYield: y(13.9, 9.6) },
      { sessionId: 'SES-125', predictedYield: null, actualYield: y(15.8, 6.2) },
      { sessionId: 'SES-126', predictedYield: null, actualYield: y(14.5, 10.1) },
      { sessionId: 'SES-127', predictedYield: null, actualYield: y(16.0, 10.8) },
      { sessionId: 'SES-128', predictedYield: null, actualYield: y(15.2, 9.7) },
    ],
  });

  console.log('[seed] selesai ✓  (login: admin/admin123 atau operator_rw04/operator123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
