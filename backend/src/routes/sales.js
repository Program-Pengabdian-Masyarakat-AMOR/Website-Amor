import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { saleDTO } from '../lib/serializers.js';

const router = Router();

router.use(requireAuth);

// GET /api/sales/summary?dari&sampai  (didefinisikan sebelum /:id agar tak bentrok)
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { dari, sampai } = req.query;
    const rows = await prisma.sale.findMany();
    const terfilter = rows.filter((s) => (!dari || s.tanggal >= dari) && (!sampai || s.tanggal <= sampai));
    const totalLiter = terfilter.reduce((a, s) => a + s.jumlahLiter, 0);
    const totalPendapatan = terfilter.reduce((a, s) => a + s.totalHarga, 0);
    res.json({
      periode: { dari: dari || null, sampai: sampai || null },
      jumlah_transaksi: terfilter.length,
      total_liter: Number(totalLiter.toFixed(1)),
      total_pendapatan: totalPendapatan,
    });
  })
);

// GET /api/sales
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.sale.findMany({ orderBy: { tanggal: 'desc' } });
    res.json(rows.map(saleDTO));
  })
);

// POST /api/sales
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const liter = Number(b.jumlah_liter);
    const harga = Number(b.harga_per_liter);
    if (!(liter > 0) || !(harga > 0) || !b.tanggal || !b.pembeli) {
      return res.status(400).json({ message: 'Tanggal, jumlah liter, harga, dan pembeli wajib benar.' });
    }
    const row = await prisma.sale.create({
      data: { tanggal: b.tanggal, jumlahLiter: liter, hargaPerLiter: harga, totalHarga: liter * harga, pembeli: b.pembeli },
    });
    res.status(201).json(saleDTO(row));
  })
);

// PUT /api/sales/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const exists = await prisma.sale.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'Penjualan tidak ditemukan.' });
    const liter = b.jumlah_liter != null ? Number(b.jumlah_liter) : exists.jumlahLiter;
    const harga = b.harga_per_liter != null ? Number(b.harga_per_liter) : exists.hargaPerLiter;
    const row = await prisma.sale.update({
      where: { id },
      data: {
        tanggal: b.tanggal ?? exists.tanggal,
        jumlahLiter: liter,
        hargaPerLiter: harga,
        totalHarga: liter * harga,
        pembeli: b.pembeli ?? exists.pembeli,
      },
    });
    res.json(saleDTO(row));
  })
);

// DELETE /api/sales/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.sale.deleteMany({ where: { id } });
    res.json({ id });
  })
);

export default router;
