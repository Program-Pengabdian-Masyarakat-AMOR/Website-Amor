import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { productionDTO } from '../lib/serializers.js';

const router = Router();

// GET /api/production-logs
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await prisma.productionLog.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rows.map(productionDTO));
  })
);

// POST /api/production-logs (manual/entri backend)
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const sampah = Number(b.berat_sampah_total) || 0;
    const minyak = Number(b.berat_minyak_total) || 0;
    const row = await prisma.productionLog.create({
      data: {
        sessionId: b.session_id || `SES-${Date.now()}`,
        beratSampahTotal: sampah,
        beratMinyakTotal: minyak,
        yieldPercent: b.yield_percent != null ? Number(b.yield_percent) : sampah > 0 ? Number(((minyak / sampah) * 100).toFixed(1)) : 0,
        waktuProsesDetik: Math.round(Number(b.waktu_proses_detik) || 0),
        suhuPirolisisAvg: b.suhu_pirolisis_avg != null ? Number(b.suhu_pirolisis_avg) : null,
        suhuTungkuAvg: b.suhu_tungku_avg != null ? Number(b.suhu_tungku_avg) : null,
      },
    });
    res.status(201).json(productionDTO(row));
  })
);

export default router;
