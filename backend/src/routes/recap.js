import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { feederMovementDTO, healthDTO, productionDTO } from '../lib/serializers.js';

const router = Router();

router.use(allow('admin'));

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 5000;

// Rentang tanggal dibaca dalam WIB (UTC+7), inklusif di kedua ujung.
function filterTanggal({ dari, sampai }) {
  if ((dari && !TANGGAL.test(dari)) || (sampai && !TANGGAL.test(sampai))) {
    throw Object.assign(new Error('Format tanggal harus YYYY-MM-DD.'), { status: 400 });
  }
  const createdAt = {};
  if (dari) createdAt.gte = new Date(`${dari}T00:00:00+07:00`);
  if (sampai) createdAt.lte = new Date(`${sampai}T23:59:59.999+07:00`);
  return Object.keys(createdAt).length ? { createdAt } : {};
}

const JENIS = {
  // Sesi produksi + prediksi yield AI + status health per sesi.
  production: async (where) => {
    const logs = await prisma.productionLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ROWS });
    const sessionIds = logs.map((l) => l.sessionId);
    const [preds, healths] = await Promise.all([
      prisma.prediction.findMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.healthStatus.findMany({ where: { sessionId: { in: sessionIds } } }),
    ]);
    const predBy = new Map(preds.map((p) => [p.sessionId, p]));
    const healthBy = new Map(healths.map((h) => [h.sessionId, h]));
    return logs.map((l) => ({
      ...productionDTO(l),
      predicted_yield: predBy.get(l.sessionId)?.predictedYield ?? null,
      health_status: healthBy.get(l.sessionId)?.status ?? null,
    }));
  },
  health: async (where) =>
    (await prisma.healthStatus.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ROWS })).map(healthDTO),
  feeder: async (where) =>
    (await prisma.feederMovement.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ROWS })).map(feederMovementDTO),
};

// GET /api/recap/:jenis?dari=YYYY-MM-DD&sampai=YYYY-MM-DD → { jenis, dari, sampai, total, rows }
router.get(
  '/:jenis',
  asyncHandler(async (req, res) => {
    const ambil = JENIS[req.params.jenis];
    if (!ambil) return res.status(404).json({ message: 'Jenis rekap tidak dikenal.' });
    const rows = await ambil(filterTanggal(req.query));
    res.json({ jenis: req.params.jenis, dari: req.query.dari || null, sampai: req.query.sampai || null, total: rows.length, rows });
  })
);

export default router;
