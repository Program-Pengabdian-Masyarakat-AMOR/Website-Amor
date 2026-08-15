import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { productionDTO } from '../lib/serializers.js';
import { DEFAULT_SETPOINTS } from '../lib/thresholds.js';
import { upsertPrediction, upsertSessionHealth, refreshMonthlyHealth } from '../services/productionAi.js';

const router = Router();

function cleanBand(input, fallback) {
  const low = Number(input?.bawah);
  const high = Number(input?.atas);
  if (Number.isFinite(low) && Number.isFinite(high) && high > low) return { bawah: low, atas: high };
  return { ...fallback };
}

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
    const pyroBand = cleanBand(b.pirolisis_setpoint || {
      bawah: b.pirolisis_setpoint_bawah,
      atas: b.pirolisis_setpoint_atas,
    }, DEFAULT_SETPOINTS.pirolisis);
    const furnaceBand = cleanBand(b.tungku_setpoint || {
      bawah: b.tungku_setpoint_bawah,
      atas: b.tungku_setpoint_atas,
    }, DEFAULT_SETPOINTS.tungku);
    const avgPir = b.suhu_pirolisis_avg != null ? Number(b.suhu_pirolisis_avg) : null;
    const avgTun = b.suhu_tungku_avg != null ? Number(b.suhu_tungku_avg) : null;
    const filteredPir = b.suhu_pirolisis_filtered != null ? Number(b.suhu_pirolisis_filtered) : avgPir;
    const filteredTun = b.suhu_tungku_filtered != null ? Number(b.suhu_tungku_filtered) : avgTun;

    const row = await prisma.productionLog.create({
      data: {
        sessionId: b.session_id || `SES-${Date.now()}`,
        beratSampahTotal: sampah,
        beratMinyakTotal: minyak,
        yieldPercent: b.yield_percent != null ? Number(b.yield_percent) : sampah > 0 ? Number(((minyak / sampah) * 100).toFixed(1)) : 0,
        waktuProsesDetik: Math.round(Number(b.waktu_proses_ms) || 0), // kolom = milidetik
        suhuPirolisisAvg: avgPir,
        suhuTungkuAvg: avgTun,
        suhuPirolisisFiltered: filteredPir,
        suhuTungkuFiltered: filteredTun,
        pirolisisSetpointBawah: pyroBand.bawah,
        pirolisisSetpointAtas: pyroBand.atas,
        tungkuSetpointBawah: furnaceBand.bawah,
        tungkuSetpointAtas: furnaceBand.atas,
      },
    });
    await Promise.all([
      upsertPrediction({
        sessionId: row.sessionId,
        actualYield: row.yieldPercent,
        inputKg: row.beratSampahTotal,
        outputKg: row.beratMinyakTotal,
        elapsedMs: row.waktuProsesDetik,
        pyroAvg: filteredPir,
        furnaceAvg: filteredTun,
        pyroBand,
        furnaceBand,
      }),
      upsertSessionHealth({
        sessionId: row.sessionId,
        pyroAvg: filteredPir,
        furnaceAvg: filteredTun,
        pyroBand,
        furnaceBand,
      }),
    ]);
    await refreshMonthlyHealth(row.createdAt);
    res.status(201).json(productionDTO(row));
  })
);

export default router;
