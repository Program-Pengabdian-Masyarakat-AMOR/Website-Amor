import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { productionDTO } from '../lib/serializers.js';
import { upsertPrediction, upsertSessionHealth, refreshMonthlyHealth } from '../services/productionAi.js';

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
        waktuProsesDetik: Math.round(Number(b.waktu_proses_ms) || 0), // kolom = milidetik
        suhuPirolisisAvg: b.suhu_pirolisis_avg != null ? Number(b.suhu_pirolisis_avg) : null,
        suhuTungkuAvg: b.suhu_tungku_avg != null ? Number(b.suhu_tungku_avg) : null,
      },
    });
    await Promise.all([
      upsertPrediction({
        sessionId: row.sessionId,
        actualYield: row.yieldPercent,
        inputKg: row.beratSampahTotal,
        outputKg: row.beratMinyakTotal,
        elapsedMs: row.waktuProsesDetik,
        pyroAvg: row.suhuPirolisisAvg,
        furnaceAvg: row.suhuTungkuAvg,
      }),
      upsertSessionHealth({ sessionId: row.sessionId, pyroAvg: row.suhuPirolisisAvg, furnaceAvg: row.suhuTungkuAvg }),
    ]);
    await refreshMonthlyHealth(row.createdAt);
    res.status(201).json(productionDTO(row));
  })
);

export default router;
